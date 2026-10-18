import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PaymentIntent, PaymentIntentStatus, Tenant } from '@prisma/client';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { money } from '../../common/utils';

/**
 * Pagamentos dos clientes das barbearias:
 *  - CreativePay (conta/aplicação da própria barbearia): Pix com QR code, checkout hospedado (Pix/cartão)
 *  - Maquininha: Mercado Pago Point (cobrança enviada ao aparelho via API)
 * Sinais (pré-pagamento) de agendamentos e pagamentos de comandas (balcão, totem, área do cliente).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  // ------------------------------------------------------------------
  // Configuração
  // ------------------------------------------------------------------
  cpBase() {
    return (this.config.get<string>('CREATIVE_PAY_BASE_URL') || 'https://pay.creativenext.cloud').replace(/\/$/, '');
  }

  hasCreativePay(t: Tenant) {
    return t.onlinePaymentEnabled && !!t.cpApiKey;
  }

  hasPos(t: Tenant) {
    return t.posEnabled && t.posProvider === 'MERCADOPAGO_POINT' && !!t.posAccessToken && !!t.posDeviceId;
  }

  customerEmail(client: { email?: string | null; phone?: string | null; id: string }) {
    if (client.email) return client.email;
    const domain = this.config.get<string>('CUSTOMER_EMAIL_DOMAIN') || 'clientes.connectbarber.app';
    return `${client.phone || client.id}@${domain}`;
  }

  // ------------------------------------------------------------------
  // Criação de cobranças
  // ------------------------------------------------------------------
  /** Pix (QR code) ou checkout hospedado para uma comanda, um agendamento (sinal) ou valor avulso */
  async createCharge(
    tenant: Tenant,
    input: { kind: 'PIX' | 'HOSTED'; amount: number; orderId?: string; appointmentId?: string; clientId?: string; description?: string; returnUrl?: string; customer: { name: string; email?: string | null; phone?: string | null; document?: string | null; id: string } },
  ): Promise<PaymentIntent> {
    if (!this.hasCreativePay(tenant)) throw new BadRequestException('Pagamento online não está configurado nesta barbearia');
    const amount = money(input.amount);
    if (amount <= 0) throw new BadRequestException('Valor inválido');
    const customer = { name: input.customer.name, email: this.customerEmail(input.customer), phone: input.customer.phone ?? undefined, cpf: input.customer.document ?? undefined };
    const metadata = { tenantId: tenant.id, orderId: input.orderId, appointmentId: input.appointmentId, kind: input.orderId ? 'ORDER' : 'APPOINTMENT' };
    const headers = { 'X-API-Key': tenant.cpApiKey!, 'Content-Type': 'application/json' };
    try {
      if (input.kind === 'PIX') {
        const { data } = await axios.post(`${this.cpBase()}/api/v1/payments/pix`, { customer, amount, currency: 'BRL', metadata, idempotency_key: `${input.orderId ?? input.appointmentId}-${Date.now()}` }, { headers, timeout: 25000 });
        return this.prisma.paymentIntent.create({
          data: {
            tenantId: tenant.id,
            orderId: input.orderId,
            appointmentId: input.appointmentId,
            clientId: input.clientId,
            provider: 'CREATIVEPAY',
            kind: 'PIX',
            amount,
            externalId: data?.order_id != null ? String(data.order_id) : null,
            qrCode: data?.qrcode ?? null,
            copyPaste: data?.copy_paste ?? null,
            expiresAt: new Date(Date.now() + 30 * 60000),
            payload: { description: input.description },
          },
        });
      }
      const { data } = await axios.post(
        `${this.cpBase()}/api/v1/checkout/sessions`,
        { customer, amount, currency: 'BRL', metadata, return_url: input.returnUrl, expires_in: 60 },
        { headers, timeout: 25000 },
      );
      return this.prisma.paymentIntent.create({
        data: {
          tenantId: tenant.id,
          orderId: input.orderId,
          appointmentId: input.appointmentId,
          clientId: input.clientId,
          provider: 'CREATIVEPAY',
          kind: 'HOSTED',
          amount,
          externalId: data?.session_id != null ? String(data.session_id) : null,
          checkoutUrl: data?.checkout_url ?? null,
          expiresAt: data?.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 60 * 60000),
          payload: { description: input.description },
        },
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message;
      this.logger.warn(`CreativePay (${tenant.slug}): ${msg}`);
      throw new BadRequestException(`Não foi possível gerar a cobrança: ${msg}`);
    }
  }

  /** Envia a cobrança para a maquininha (Mercado Pago Point) */
  async createPosCharge(tenant: Tenant, input: { amount: number; orderId: string; clientId?: string; description?: string }): Promise<PaymentIntent> {
    if (!this.hasPos(tenant)) throw new BadRequestException('Maquininha não configurada nesta barbearia');
    const amount = money(input.amount);
    if (amount <= 0) throw new BadRequestException('Valor inválido');
    try {
      const { data } = await axios.post(
        `https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(tenant.posDeviceId!)}/payment-intents`,
        { amount: Math.round(amount * 100), additional_info: { external_reference: input.orderId, print_on_terminal: true } },
        { headers: { Authorization: `Bearer ${tenant.posAccessToken}`, 'Content-Type': 'application/json' }, timeout: 20000 },
      );
      return this.prisma.paymentIntent.create({
        data: { tenantId: tenant.id, orderId: input.orderId, clientId: input.clientId, provider: 'MERCADOPAGO_POINT', kind: 'POS', amount, externalId: String(data?.id ?? ''), expiresAt: new Date(Date.now() + 10 * 60000), payload: { description: input.description, device: tenant.posDeviceId } },
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message;
      this.logger.warn(`Mercado Pago Point (${tenant.slug}): ${msg}`);
      throw new BadRequestException(`Maquininha: ${msg}`);
    }
  }

  async cancelIntent(tenantId: string, id: string) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id, tenantId } });
    if (!intent) throw new NotFoundException('Cobrança não encontrada');
    if (intent.status !== 'PENDING') return intent;
    if (intent.provider === 'MERCADOPAGO_POINT' && intent.externalId) {
      const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      try {
        await axios.delete(`https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(tenant.posDeviceId!)}/payment-intents/${encodeURIComponent(intent.externalId)}`, { headers: { Authorization: `Bearer ${tenant.posAccessToken}` }, timeout: 15000 });
      } catch (e: any) {
        this.logger.warn(`Cancelar na maquininha falhou: ${e?.response?.data?.message || e.message}`);
      }
    }
    return this.prisma.paymentIntent.update({ where: { id }, data: { status: 'EXPIRED' } });
  }

  // ------------------------------------------------------------------
  // Status
  // ------------------------------------------------------------------
  async getIntent(id: string, tenantId?: string) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!intent) throw new NotFoundException('Cobrança não encontrada');
    if (intent.status === 'PENDING') return this.refresh(intent);
    return intent;
  }

  /** Consulta o provedor e liquida se já foi pago */
  async refresh(intent: PaymentIntent): Promise<PaymentIntent> {
    if (intent.status !== 'PENDING') return intent;
    if (intent.expiresAt && intent.expiresAt < new Date()) {
      return this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'EXPIRED' } });
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: intent.tenantId } });
    if (!tenant || !intent.externalId) return intent;
    try {
      if (intent.provider === 'CREATIVEPAY' && tenant.cpApiKey) {
        const { data } = await axios.get(`${this.cpBase()}/api/v1/payments/${encodeURIComponent(intent.externalId)}`, { headers: { 'X-API-Key': tenant.cpApiKey }, timeout: 15000 });
        const st = String(data?.status ?? '').toLowerCase();
        if (['paid', 'completed', 'approved', 'succeeded'].includes(st)) return this.settle(intent.id, data);
        if (['cancelled', 'canceled', 'expired', 'failed', 'refused'].includes(st)) return this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: st === 'failed' || st === 'refused' ? 'FAILED' : 'EXPIRED', payload: data } });
      }
      if (intent.provider === 'MERCADOPAGO_POINT' && tenant.posAccessToken) {
        const { data } = await axios.get(`https://api.mercadopago.com/point/integration-api/payment-intents/${encodeURIComponent(intent.externalId)}`, { headers: { Authorization: `Bearer ${tenant.posAccessToken}` }, timeout: 15000 });
        const st = String(data?.state ?? '').toUpperCase();
        if (st === 'FINISHED') return this.settle(intent.id, data);
        if (['CANCELED', 'ABANDONED', 'ERROR'].includes(st)) return this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: st === 'ERROR' ? 'FAILED' : 'EXPIRED', payload: data } });
      }
    } catch (e: any) {
      this.logger.debug(`refresh ${intent.id}: ${e?.response?.data?.message || e.message}`);
    }
    return intent;
  }

  /** Marca como pago e aplica: comanda → pagamento; agendamento → sinal */
  async settle(intentId: string, payload?: any): Promise<PaymentIntent> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.status === 'PAID') return intent!;
    const method = intent.provider === 'MERCADOPAGO_POINT' ? this.posMethod(payload) : 'ONLINE';
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'PAID', payload: payload ?? undefined } });
      if (intent.orderId) {
        const order = await tx.order.findUnique({ where: { id: intent.orderId } });
        if (order && order.status === 'OPEN') {
          await tx.payment.create({ data: { orderId: order.id, method, amount: intent.amount, installments: 1, feePct: 0, feeAmount: 0, netAmount: intent.amount, reference: `${intent.provider}:${intent.externalId ?? intent.id}` } });
          await tx.order.update({ where: { id: order.id }, data: { paidTotal: { increment: intent.amount } } });
        }
      }
      if (intent.appointmentId) {
        const a = await tx.appointment.findUnique({ where: { id: intent.appointmentId } });
        if (a) {
          await tx.appointment.update({ where: { id: a.id }, data: { prepaidAmount: { increment: intent.amount }, status: a.status === 'SCHEDULED' ? 'CONFIRMED' : a.status, confirmedAt: a.confirmedAt ?? new Date() } });
          // se já existe comanda, lança o pagamento nela
          if (a.orderId) {
            const order = await tx.order.findUnique({ where: { id: a.orderId } });
            if (order && order.status === 'OPEN') {
              await tx.payment.create({ data: { orderId: order.id, method: 'ONLINE', amount: intent.amount, installments: 1, feePct: 0, feeAmount: 0, netAmount: intent.amount, reference: `${intent.provider}:${intent.externalId ?? intent.id}` } });
              await tx.order.update({ where: { id: order.id }, data: { paidTotal: { increment: intent.amount } } });
            }
          }
        }
      }
      return u;
    });
    this.logger.log(`Pagamento liquidado ${intentId} (${intent.provider}) R$ ${intent.amount}`);
    return updated;
  }

  private posMethod(payload: any): 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'OTHER' {
    const pm = String(payload?.payment?.type ?? payload?.payment_method?.type ?? payload?.payment?.payment_method_id ?? '').toLowerCase();
    if (pm.includes('debit')) return 'DEBIT_CARD';
    if (pm.includes('credit')) return 'CREDIT_CARD';
    if (pm.includes('pix') || pm.includes('qr')) return 'PIX';
    return 'CREDIT_CARD';
  }

  // ------------------------------------------------------------------
  // Webhook do CreativePay da barbearia
  // ------------------------------------------------------------------
  async handleTenantWebhook(tenantId: string, rawBody: Buffer, headers: Record<string, any>, body: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Barbearia não encontrada');
    if (tenant.cpWebhookSecret) {
      const sig = headers['x-creativepay-signature'] ?? headers['x-getfy-signature'];
      if (!sig || typeof sig !== 'string') throw new UnauthorizedException('Assinatura ausente');
      const expected = createHmac('sha256', tenant.cpWebhookSecret).update(rawBody).digest('hex');
      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Assinatura inválida');
    }
    const event: string = body?.event ?? '';
    const externalId = body?.order_id != null ? String(body.order_id) : undefined;
    const meta = body?.payload?.metadata ?? body?.payload?.order?.metadata ?? body?.metadata ?? {};
    let intent = externalId ? await this.prisma.paymentIntent.findFirst({ where: { tenantId, externalId, status: 'PENDING' } }) : null;
    if (!intent && (meta.orderId || meta.appointmentId)) {
      intent = await this.prisma.paymentIntent.findFirst({ where: { tenantId, status: 'PENDING', ...(meta.orderId ? { orderId: meta.orderId } : { appointmentId: meta.appointmentId }) }, orderBy: { createdAt: 'desc' } });
    }
    this.logger.log(`Webhook CreativePay (${tenant.slug}): ${event} intent=${intent?.id ?? '-'}`);
    if (!intent) return { processed: false };
    if (event === 'order.completed') await this.settle(intent.id, body);
    else if (event === 'order.cancelled') await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'EXPIRED', payload: body } });
    else if (event === 'order.refunded') await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'REFUNDED', payload: body } });
    return { processed: true };
  }

  // ------------------------------------------------------------------
  // Pendentes: consulta periódica (fallback do webhook)
  // ------------------------------------------------------------------
  @Cron('*/1 * * * *')
  async pollPending() {
    if (process.env.DISABLE_CRON === 'true') return;
    const list = await this.prisma.paymentIntent.findMany({ where: { status: 'PENDING', createdAt: { gte: new Date(Date.now() - 2 * 3600000) } }, take: 50 });
    for (const i of list) await this.refresh(i);
  }

  /** Lista cobranças de uma comanda/agendamento */
  listFor(tenantId: string, where: { orderId?: string; appointmentId?: string }) {
    return this.prisma.paymentIntent.findMany({ where: { tenantId, ...where }, orderBy: { createdAt: 'desc' } });
  }

  statusLabel(s: PaymentIntentStatus) {
    return { PENDING: 'Aguardando pagamento', PAID: 'Pago', FAILED: 'Falhou', EXPIRED: 'Expirada', REFUNDED: 'Estornada' }[s];
  }
}
