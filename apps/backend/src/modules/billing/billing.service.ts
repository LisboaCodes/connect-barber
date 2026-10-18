import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanCode } from '@prisma/client';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { addDays, addMonths } from 'date-fns';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { money } from '../../common/utils';
import { MessagingService } from '../messaging/messaging.service';
import { PLANS, planForProfessionals } from './plans';

/**
 * Cobrança do plano das barbearias via CreativePay (checkout hospedado) e
 * pagamento online de comandas/agendamentos pelo cliente.
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
      invoices,
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

    const open = await this.prisma.invoice.findFirst({ where: { tenantId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
    if (open && open.planCode === planCode) return { invoice: open, checkoutUrl: open.checkoutUrl };
    if (open) await this.prisma.invoice.update({ where: { id: open.id }, data: { status: 'CANCELLED' } });

    const periodStart = t.planRenewsAt && t.planRenewsAt > new Date() ? t.planRenewsAt : new Date();
    const invoice = await this.prisma.invoice.create({
      data: { tenantId, planCode, amount: plan.promoPrice, periodStart, periodEnd: addMonths(periodStart, 1), dueDate: addDays(new Date(), 3) },
    });
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { planCode, maxProfessionals: plan.maxProfessionals } });

    let checkoutUrl: string | null = null;
    if (this.enabled) {
      try {
        const r = await this.createCheckout({
          amount: plan.promoPrice,
          customer: { name: t.legalName || t.name, email: t.email ?? undefined, phone: t.phone ?? undefined, document: t.document ?? undefined },
          metadata: { kind: 'INVOICE', invoiceId: invoice.id, tenantId },
          returnUrl: `${this.messaging.appUrl()}/app/plano?invoice=${invoice.id}`,
        });
        checkoutUrl = r.checkoutUrl;
        await this.prisma.invoice.update({ where: { id: invoice.id }, data: { checkoutUrl, externalId: r.sessionId } });
      } catch (e: any) {
        this.logger.warn(`Checkout CreativePay falhou: ${e.message}`);
      }
    }
    return { invoice: { ...invoice, checkoutUrl }, checkoutUrl, manual: !checkoutUrl };
  }

  /** Marca fatura como paga e ativa/renova o plano (webhook ou superadmin) */
  async markInvoicePaid(invoiceId: string, externalId?: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Fatura não encontrada');
    if (inv.status === 'PAID') return inv;
    const plan = PLANS.find((p) => p.code === inv.planCode)!;
    await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date(), externalId: externalId ?? inv.externalId } }),
      this.prisma.tenant.update({ where: { id: inv.tenantId }, data: { planCode: inv.planCode, planStatus: 'ACTIVE', planRenewsAt: inv.periodEnd, maxProfessionals: plan.maxProfessionals, isActive: true } }),
    ]);
    this.logger.log(`Fatura ${invoiceId} paga; plano ${inv.planCode} ativo até ${inv.periodEnd.toISOString()}`);
    return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
  }

  /** Gera faturas de renovação para planos que vencem em 5 dias (cron) */
  async generateRenewals() {
    const soon = addDays(new Date(), 5);
    const tenants = await this.prisma.tenant.findMany({ where: { planStatus: 'ACTIVE', planRenewsAt: { lte: soon }, deletedAt: null } });
    let created = 0;
    for (const t of tenants) {
      const exists = await this.prisma.invoice.findFirst({ where: { tenantId: t.id, status: 'OPEN', periodStart: t.planRenewsAt! } });
      if (exists) continue;
      const plan = PLANS.find((p) => p.code === t.planCode);
      if (!plan || plan.code === 'TRIAL') continue;
      const inv = await this.prisma.invoice.create({ data: { tenantId: t.id, planCode: t.planCode, amount: plan.promoPrice, periodStart: t.planRenewsAt!, periodEnd: addMonths(t.planRenewsAt!, 1), dueDate: t.planRenewsAt! } });
      if (this.enabled) {
        try {
          const r = await this.createCheckout({ amount: plan.promoPrice, customer: { name: t.legalName || t.name, email: t.email ?? undefined, phone: t.phone ?? undefined }, metadata: { kind: 'INVOICE', invoiceId: inv.id, tenantId: t.id }, returnUrl: `${this.messaging.appUrl()}/app/plano?invoice=${inv.id}` });
          await this.prisma.invoice.update({ where: { id: inv.id }, data: { checkoutUrl: r.checkoutUrl, externalId: r.sessionId } });
        } catch (e: any) {
          this.logger.warn(`Checkout de renovação falhou (${t.slug}): ${e.message}`);
        }
      }
      if (t.email) {
        const url = `${this.messaging.appUrl()}/app/plano`;
        this.messaging['email'].send(t.email, `Fatura do Connect Barber - ${plan.name}`, this.messaging.basicHtml(`Olá, ${t.name}!\n\nSua fatura de R$ ${plan.promoPrice.toFixed(2)} (${plan.name}) vence em ${inv.dueDate.toLocaleDateString('pt-BR')}.\nPague em: ${url}\n\nObrigado por usar o Connect Barber!`)).catch(() => undefined);
      }
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
    const r = await this.createCheckout({
      amount: remaining,
      customer: { name: order.client?.name ?? 'Cliente', email: order.client?.email ?? undefined, phone: order.client?.phone ?? undefined },
      metadata: { kind: 'ORDER', orderId, tenantId },
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
      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Assinatura inválida');
    }
    const event: string = body?.event ?? '';
    const meta = body?.payload?.metadata ?? body?.payload?.order?.metadata ?? body?.metadata ?? {};
    const externalId = body?.order_id != null ? String(body.order_id) : undefined;
    this.logger.log(`Webhook CreativePay: ${event} kind=${meta.kind} invoice=${meta.invoiceId} order=${meta.orderId}`);
    if (event === 'order.completed') {
      if (meta.kind === 'INVOICE' && meta.invoiceId) await this.markInvoicePaid(meta.invoiceId, externalId);
      if (meta.kind === 'ORDER' && meta.orderId) await this.settleOrderPayment(meta.orderId, externalId, body);
    } else if (event === 'order.refunded' || event === 'order.cancelled') {
      if (meta.kind === 'ORDER' && meta.orderId) {
        await this.prisma.paymentIntent.updateMany({ where: { orderId: meta.orderId, status: 'PENDING' }, data: { status: event === 'order.refunded' ? 'REFUNDED' : 'EXPIRED', payload: body } });
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
  private async createCheckout(input: { amount: number; customer: { name: string; email?: string; phone?: string; document?: string }; metadata: Record<string, any>; returnUrl: string }) {
    const base = (this.config.get<string>('CREATIVE_PAY_BASE_URL') || '').replace(/\/$/, '');
    const key = this.config.get<string>('CREATIVE_PAY_API_KEY');
    const { data } = await axios.post(
      `${base}/api/v1/checkout/sessions`,
      { customer: input.customer, amount: money(input.amount), currency: 'BRL', metadata: input.metadata, return_url: input.returnUrl, expires_in: 60 },
      { headers: { 'X-API-Key': key, 'Content-Type': 'application/json' }, timeout: 20000 },
    );
    return { sessionId: data?.session_id != null ? String(data.session_id) : null, checkoutUrl: data?.checkout_url ?? null };
  }
}
