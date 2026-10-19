import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanCode, Tenant } from '@prisma/client';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { addDays, addMinutes, addMonths } from 'date-fns';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { money } from '../../common/utils';
import { MessagingService } from '../messaging/messaging.service';
import { PLANS, planForProfessionals } from './plans';

/** Duração (minutos) da sessão de checkout hospedado no CreativePay (máximo aceito: 1440). */
const CHECKOUT_MINUTES = 1440;

/**
 * Cobrança do plano das barbearias via CreativePay (checkout hospedado) e
 * pagamento online de comandas/agendamentos pelo cliente.
 *
 * CreativePay (Aplicação de API):
 * - `POST /api/v1/checkout/sessions` com `X-API-Key` → `{ session_id, checkout_url, expires_at }`.
 *   `customer.email` é obrigatório; `customer.cpf` só aceita CPF (11 dígitos).
 * - Webhook assinado com `X-CreativePay-Signature` = HMAC-SHA256(corpo, webhook_secret);
 *   corpo `{ event, order_id, payload: { order: { metadata } }, timestamp }`;
 *   eventos `order.pending`, `order.completed`, `order.refunded`.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService, private config: ConfigService, private messaging: MessagingService) {}

  get enabled() {
    return !!(this.config.get('CREATIVE_PAY_BASE_URL') && this.config.get('CREATIVE_PAY_API_KEY'));
  }

  // ---------------- plano da barbearia ----------------
  async overview(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const activePros = await this.prisma.professional.count({ where: { tenantId, isActive: true, deletedAt: null } });
    const invoices = await this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { dueDate: 'desc' }, take: 24 });
    const current = PLANS.find((p) => p.code === t.planCode) ?? PLANS[0];
    const suggested = planForProfessionals(Math.max(1, activePros));
    const now = new Date();
    const trialDaysLeft = t.trialEndsAt ? Math.max(0, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86400000)) : null;
    return {
      plan: current,
      status: t.planStatus,
      trialEndsAt: t.trialEndsAt,
      trialDaysLeft,
      renewsAt: t.planRenewsAt,
      activeProfessionals: activePros,
      suggestedPlan: suggested,
      plans: PLANS.filter((p) => p.code !== 'TRIAL'),
      invoices: invoices.map((i) => ({ ...i, checkoutUrl: this.liveCheckoutUrl(i) })),
      onlinePayments: this.enabled,
    };
  }

  /** Escolhe/assina um plano: gera a fatura do mês e (se configurado) o link de pagamento */
  async subscribe(tenantId: string, planCode: PlanCode) {
    const plan = PLANS.find((p) => p.code === planCode && p.code !== 'TRIAL');
    if (!plan) throw new BadRequestException('Plano inválido');
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const activePros = await this.prisma.professional.count({ where: { tenantId, isActive: true, deletedAt: null } });
    if (activePros > plan.maxProfessionals) throw new BadRequestException(`Você tem ${activePros} profissionais ativos; este plano permite até ${plan.maxProfessionals}`);

    const open = await this.prisma.invoice.findFirst({ where: { tenantId, status: { in: ['OPEN', 'OVERDUE'] } }, orderBy: { createdAt: 'desc' } });
    let invoice = open && open.planCode === planCode ? open : null;
    if (!invoice) {
      if (open) await this.prisma.invoice.update({ where: { id: open.id }, data: { status: 'CANCELLED' } });
      const periodStart = t.planRenewsAt && t.planRenewsAt > new Date() ? t.planRenewsAt : new Date();
      invoice = await this.prisma.invoice.create({
        data: { tenantId, planCode, amount: plan.promoPrice, periodStart, periodEnd: addMonths(periodStart, 1), dueDate: addDays(new Date(), 3) },
      });
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { planCode, maxProfessionals: plan.maxProfessionals } });
    }

    let checkoutUrl: string | null = null;
    if (this.enabled) {
      try {
        checkoutUrl = await this.ensureInvoiceCheckout(invoice, t);
      } catch (e: any) {
        this.logger.warn(`Checkout CreativePay falhou (${t.slug}): ${e.message}`);
      }
    }
    return { invoice: { ...invoice, checkoutUrl }, checkoutUrl, manual: !checkoutUrl };
  }

  /** Link de pagamento de uma fatura em aberto (gera uma sessão nova quando a anterior expirou) */
  async invoiceCheckout(tenantId: string, invoiceId: string) {
    if (!this.enabled) throw new BadRequestException('Pagamento online não configurado. Nossa equipe entrará em contato para combinar o pagamento.');
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!inv) throw new NotFoundException('Fatura não encontrada');
    if (inv.status === 'PAID') throw new BadRequestException('Esta fatura já está paga');
    if (inv.status === 'CANCELLED') throw new BadRequestException('Esta fatura foi cancelada');
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const checkoutUrl = await this.ensureInvoiceCheckout(inv, t);
    return { checkoutUrl, invoiceId: inv.id };
  }

  /** Marca fatura como paga e ativa/renova o plano (webhook ou superadmin) */
  async markInvoicePaid(invoiceId: string, externalId?: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { tenant: true } });
    if (!inv) throw new NotFoundException('Fatura não encontrada');
    if (inv.status === 'PAID') return inv;
    const plan = PLANS.find((p) => p.code === inv.planCode)!;
    await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date(), externalId: externalId ?? inv.externalId } }),
      this.prisma.tenant.update({ where: { id: inv.tenantId }, data: { planCode: inv.planCode, planStatus: 'ACTIVE', planRenewsAt: inv.periodEnd, maxProfessionals: plan.maxProfessionals, isActive: true } }),
    ]);
    this.logger.log(`Fatura ${invoiceId} paga; plano ${inv.planCode} ativo até ${inv.periodEnd.toISOString()}`);
    const until = inv.periodEnd.toLocaleDateString('pt-BR');
    const text = `Pagamento confirmado! ✅\n\nSua assinatura do Connect Barber (${plan.name}) está ativa até ${until}.\n\nObrigado por confiar na gente!`;
    void this.messaging.sendPlatformEmail(await this.billingEmail(inv.tenant), 'Pagamento confirmado - Connect Barber', text);
    void this.messaging.sendPlatformWhatsApp(inv.tenant.phone, text);
    return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
  }

  /** Gera faturas de renovação para planos que vencem em 5 dias (cron) */
  async generateRenewals() {
    const soon = addDays(new Date(), 5);
    const tenants = await this.prisma.tenant.findMany({ where: { planStatus: 'ACTIVE', planRenewsAt: { lte: soon }, deletedAt: null } });
    let created = 0;
    for (const t of tenants) {
      const exists = await this.prisma.invoice.findFirst({ where: { tenantId: t.id, status: { in: ['OPEN', 'OVERDUE'] }, periodStart: t.planRenewsAt! } });
      if (exists) continue;
      const plan = PLANS.find((p) => p.code === t.planCode);
      if (!plan || plan.code === 'TRIAL') continue;
      const inv = await this.prisma.invoice.create({ data: { tenantId: t.id, planCode: t.planCode, amount: plan.promoPrice, periodStart: t.planRenewsAt!, periodEnd: addMonths(t.planRenewsAt!, 1), dueDate: t.planRenewsAt! } });
      // O link de pagamento é gerado na hora em que o dono clica em "Pagar" (a sessão do checkout expira em 24h).
      const url = `${this.messaging.appUrl()}/app/plano?invoice=${inv.id}`;
      const how = this.enabled ? 'Pague por Pix ou cartão em:' : 'Veja os detalhes em:';
      const text = `Olá, ${t.name}!\n\nSua fatura do Connect Barber (${plan.name}) de R$ ${plan.promoPrice.toFixed(2)} vence em ${inv.dueDate.toLocaleDateString('pt-BR')}.\n\n${how} ${url}\n\nObrigado por usar o Connect Barber!`;
      void this.messaging.sendPlatformEmail(await this.billingEmail(t), `Fatura do Connect Barber - ${plan.name}`, text);
      void this.messaging.sendPlatformWhatsApp(t.phone, text);
      created++;
    }
    return created;
  }

  /** Marca vencidas e bloqueia inadimplentes (cron) */
  async enforce() {
    const today = new Date();
    await this.prisma.invoice.updateMany({ where: { status: 'OPEN', dueDate: { lt: today } }, data: { status: 'OVERDUE' } });
    // PAST_DUE: plano venceu e há fatura vencida
    const expired = await this.prisma.tenant.findMany({ where: { planStatus: 'ACTIVE', planRenewsAt: { lt: today } } });
    for (const t of expired) {
      await this.prisma.tenant.update({ where: { id: t.id }, data: { planStatus: 'PAST_DUE' } });
    }
    // bloqueio após 7 dias em atraso
    const limit = addDays(today, -7);
    const pastDue = await this.prisma.tenant.findMany({ where: { planStatus: 'PAST_DUE', planRenewsAt: { lt: limit } } });
    for (const t of pastDue) await this.prisma.tenant.update({ where: { id: t.id }, data: { planStatus: 'BLOCKED' } });
    return { expired: expired.length, blocked: pastDue.length };
  }

  // ---------------- pagamento online de comanda (cliente) ----------------
  async createOrderCheckout(tenantId: string, orderId: string, returnUrl: string) {
    if (!this.enabled) throw new BadRequestException('Pagamento online não configurado');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId, status: 'OPEN' }, include: { client: true } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    const remaining = money(Number(order.total) - Number(order.paidTotal));
    if (remaining <= 0) throw new BadRequestException('Comanda já paga');
    const email = order.client?.email || (await this.billingEmail(await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })));
    if (!email) throw new BadRequestException('O cliente precisa ter um e-mail cadastrado para pagar online');
    const r = await this.createCheckout({
      amount: remaining,
      customer: { name: order.client?.name ?? 'Cliente', email, phone: this.digits(order.client?.phone) || undefined },
      metadata: { kind: 'ORDER', orderId, tenantId, origem: 'connect-barber' },
      returnUrl,
    });
    const intent = await this.prisma.paymentIntent.create({ data: { tenantId, orderId, amount: remaining, externalId: r.sessionId, checkoutUrl: r.checkoutUrl } });
    return { intent, checkoutUrl: r.checkoutUrl };
  }

  // ---------------- webhook ----------------
  async handleWebhook(rawBody: Buffer, headers: Record<string, any>, body: any) {
    const secret = this.config.get<string>('CREATIVE_PAY_WEBHOOK_SECRET');
    if (secret) {
      const sig = headers['x-creativepay-signature'] ?? headers['x-getfy-signature'];
      if (!sig || typeof sig !== 'string') throw new UnauthorizedException('Assinatura ausente');
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(sig.trim().toLowerCase(), 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Assinatura inválida');
    }
    const event: string = String(body?.event ?? '');
    const externalId = body?.order_id != null ? String(body.order_id) : undefined;
    let meta = this.extractMetadata(body);
    // Versões antigas do CreativePay mandam o pedido sem metadata; o detalhe do pedido pela API traz.
    if (!meta.invoiceId && !meta.orderId && externalId && this.enabled) {
      try {
        const detail = await this.fetchOrder(externalId);
        meta = this.extractMetadata(detail);
      } catch (e: any) {
        this.logger.warn(`Não consegui consultar o pedido ${externalId} no CreativePay: ${e.message}`);
      }
    }
    this.logger.log(`Webhook CreativePay: ${event} order=${externalId ?? '-'} kind=${meta.kind ?? '-'} invoice=${meta.invoiceId ?? '-'} comanda=${meta.orderId ?? '-'}`);
    if (!meta.invoiceId && !meta.orderId) return { processed: false, reason: 'sem referência' };

    if (event === 'order.completed') {
      if (meta.invoiceId) {
        const inv = await this.prisma.invoice.findUnique({ where: { id: String(meta.invoiceId) } });
        if (!inv) {
          this.logger.warn(`Webhook CreativePay: fatura ${meta.invoiceId} não existe (pedido ${externalId ?? '?'})`);
          return { processed: false, reason: 'fatura não encontrada' };
        }
        await this.markInvoicePaid(inv.id, externalId);
      }
      if (meta.orderId) await this.settleOrderPayment(String(meta.orderId), externalId, body);
    } else if (event === 'order.pending') {
      if (meta.invoiceId && externalId) await this.prisma.invoice.updateMany({ where: { id: String(meta.invoiceId), status: { in: ['OPEN', 'OVERDUE'] } }, data: { externalId } });
    } else if (event === 'order.refunded' || event === 'order.cancelled') {
      if (meta.orderId) {
        await this.prisma.paymentIntent.updateMany({ where: { orderId: String(meta.orderId), status: 'PENDING' }, data: { status: event === 'order.refunded' ? 'REFUNDED' : 'EXPIRED', payload: body } });
      }
      if (meta.invoiceId && event === 'order.refunded') {
        // estorno da assinatura: reabre a fatura; o cron de cobrança trata o vencimento
        await this.prisma.invoice.updateMany({ where: { id: String(meta.invoiceId), status: 'PAID' }, data: { status: 'OVERDUE', paidAt: null } });
        this.logger.warn(`Fatura ${meta.invoiceId} reaberta por estorno no CreativePay (pedido ${externalId ?? '?'})`);
      }
    }
    return { processed: true };
  }

  private async settleOrderPayment(orderId: string, externalId: string | undefined, payload: any) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { orderId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (!intent) return;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'OPEN') return;
    await this.prisma.$transaction([
      this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'PAID', externalId: externalId ?? intent.externalId, payload } }),
      this.prisma.payment.create({ data: { orderId, method: 'ONLINE', amount: intent.amount, installments: 1, feePct: 0, feeAmount: 0, netAmount: intent.amount, reference: externalId } }),
      this.prisma.order.update({ where: { id: orderId }, data: { paidTotal: { increment: intent.amount } } }),
    ]);
  }

  // ---------------- CreativePay ----------------
  /** Reaproveita o link da fatura enquanto a sessão vale; senão cria uma sessão nova. */
  private async ensureInvoiceCheckout(invoice: { id: string; tenantId: string; amount: any; checkoutUrl: string | null; checkoutExpiresAt: Date | null }, tenant: Tenant) {
    const live = this.liveCheckoutUrl(invoice);
    if (live) return live;
    const customer = await this.billingCustomer(tenant);
    const r = await this.createCheckout({
      amount: Number(invoice.amount),
      customer,
      metadata: { kind: 'INVOICE', invoiceId: invoice.id, tenantId: invoice.tenantId, origem: 'connect-barber', barbearia: tenant.slug },
      returnUrl: `${this.messaging.appUrl()}/app/plano?invoice=${invoice.id}`,
    });
    if (!r.checkoutUrl) throw new BadRequestException('O CreativePay não devolveu o link de pagamento');
    const expiresAt = r.expiresAt ?? addMinutes(new Date(), CHECKOUT_MINUTES);
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { checkoutUrl: r.checkoutUrl, checkoutExpiresAt: expiresAt } });
    return r.checkoutUrl;
  }

  /** URL do checkout só enquanto faltar mais de 10 minutos para a sessão expirar */
  private liveCheckoutUrl(invoice: { checkoutUrl: string | null; checkoutExpiresAt: Date | null; status?: string }) {
    if (!invoice.checkoutUrl) return null;
    if (invoice.status && invoice.status !== 'OPEN' && invoice.status !== 'OVERDUE') return null;
    if (!invoice.checkoutExpiresAt) return null;
    return invoice.checkoutExpiresAt.getTime() - Date.now() > 10 * 60 * 1000 ? invoice.checkoutUrl : null;
  }

  private digits(s?: string | null) {
    return (s ?? '').replace(/\D/g, '');
  }

  /** E-mail de cobrança: o da barbearia ou, na falta, o do dono */
  private async billingEmail(t: Tenant): Promise<string | null> {
    if (t.email) return t.email;
    const owner = await this.prisma.membership.findFirst({ where: { tenantId: t.id, role: 'OWNER', isActive: true }, include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } });
    return owner?.user.email ?? null;
  }

  private async billingCustomer(t: Tenant) {
    const email = await this.billingEmail(t);
    if (!email) throw new BadRequestException('Cadastre o e-mail da barbearia em Configurações para gerar o link de pagamento');
    const doc = this.digits(t.document);
    const phone = this.digits(t.phone);
    return { name: t.legalName || t.name, email, ...(doc.length === 11 ? { cpf: doc } : {}), ...(phone ? { phone: phone.slice(0, 24) } : {}) };
  }

  private cpBase() {
    return (this.config.get<string>('CREATIVE_PAY_BASE_URL') || 'https://pay.creativenext.cloud').replace(/\/$/, '');
  }

  private cpHeaders() {
    return { 'X-API-Key': this.config.get<string>('CREATIVE_PAY_API_KEY') ?? '', Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  private async createCheckout(input: { amount: number; customer: { name: string; email: string; phone?: string; cpf?: string }; metadata: Record<string, any>; returnUrl: string }) {
    const { data } = await axios.post(
      `${this.cpBase()}/api/v1/checkout/sessions`,
      { customer: input.customer, amount: money(input.amount), currency: 'BRL', metadata: input.metadata, return_url: input.returnUrl, expires_in: CHECKOUT_MINUTES },
      { headers: this.cpHeaders(), timeout: 20000 },
    );
    const expiresAt = data?.expires_at ? new Date(data.expires_at) : null;
    return {
      sessionId: data?.session_id != null ? String(data.session_id) : null,
      checkoutUrl: (data?.checkout_url as string | undefined) ?? null,
      expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null,
    };
  }

  private async fetchOrder(orderId: string) {
    const { data } = await axios.get(`${this.cpBase()}/api/v1/payments/${encodeURIComponent(orderId)}`, { headers: this.cpHeaders(), timeout: 15000 });
    return data;
  }

  /** Procura `metadata` em qualquer nível do corpo (payload.order.metadata, payload.metadata, metadata...) */
  private extractMetadata(obj: any): Record<string, any> {
    const found = this.findKey(obj, 'metadata');
    return found && typeof found === 'object' ? (found as Record<string, any>) : {};
  }

  private findKey(obj: unknown, key: string, depth = 0): unknown {
    if (!obj || typeof obj !== 'object' || depth > 6) return undefined;
    const direct = (obj as any)[key];
    if (direct && typeof direct === 'object') return direct;
    for (const v of Object.values(obj as any)) {
      if (v && typeof v === 'object') {
        const r = this.findKey(v, key, depth + 1);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  /** Testa a chave da plataforma: um pedido inexistente responde 404 quando a chave é aceita e 401 quando não é. */
  async testConnection() {
    if (!this.enabled) return { ok: false, error: 'CREATIVE_PAY_* não configuradas' };
    try {
      await this.fetchOrder('teste-de-conexao');
      return { ok: true };
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) return { ok: true };
      return { ok: false, error: `CreativePay respondeu ${status ?? e.message}` };
    }
  }
}
