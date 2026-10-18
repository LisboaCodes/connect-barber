import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { localDayRange, money, normalizePhone, nowLocalDate, toLocalTime } from '../../common/utils';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../appointments/availability.service';
import { ClientsService } from '../clients/clients.service';
import { MessagingService } from '../messaging/messaging.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Totem de autoatendimento (tablet na recepção):
 *  identificar pelo telefone → check-in (avisa o barbeiro) → ver/pagar a comanda (Pix, maquininha ou balcão)
 *  → atendimento imediato (próximo horário livre) → agendar a próxima visita.
 */
@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  constructor(
    private prisma: PrismaService,
    private clients: ClientsService,
    private appointments: AppointmentsService,
    private availability: AvailabilityService,
    private orders: OrdersService,
    private payments: PaymentsService,
    private messaging: MessagingService,
  ) {}

  async tenant(slug: string, token?: string): Promise<Tenant> {
    const t = await this.prisma.tenant.findFirst({ where: { slug, deletedAt: null, isActive: true } });
    if (!t) throw new NotFoundException('Barbearia não encontrada');
    if (!t.kioskEnabled) throw new ForbiddenException('Totem desativado nesta barbearia');
    if (!t.kioskToken || token !== t.kioskToken) throw new UnauthorizedException('Totem não autorizado');
    return t;
  }

  /** Dados para a tela inicial do totem */
  async config(slug: string, token?: string) {
    const t = await this.tenant(slug, token);
    const [services, professionals] = await Promise.all([
      this.prisma.service.findMany({ where: { tenantId: t.id, isActive: true, deletedAt: null, allowOnlineBooking: true }, select: { id: true, name: true, price: true, durationMinutes: true, categoryId: true, imageUrl: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.professional.findMany({ where: { tenantId: t.id, isActive: true, deletedAt: null, acceptsOnlineBooking: true }, select: { id: true, name: true, avatarUrl: true, color: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    return {
      name: t.name,
      logoUrl: t.logoUrl,
      coverUrl: t.coverUrl,
      timezone: t.timezone,
      payments: { pix: this.payments.hasCreativePay(t), pos: this.payments.hasPos(t), counter: true },
      services,
      professionals,
    };
  }

  /** Identifica o cliente pelo telefone: agendamentos de hoje e comandas abertas */
  async identify(slug: string, token: string | undefined, phone: string) {
    const t = await this.tenant(slug, token);
    const p = normalizePhone(phone);
    if (!p) throw new BadRequestException('Informe o telefone');
    const client = await this.prisma.client.findFirst({ where: { tenantId: t.id, phone: p, deletedAt: null } });
    if (!client) return { found: false, phone: p };
    return { found: true, client: this.publicClient(client), ...(await this.state(t, client.id)) };
  }

  async register(slug: string, token: string | undefined, dto: { name: string; phone: string; email?: string; birthDate?: string }) {
    const t = await this.tenant(slug, token);
    if (!dto.name?.trim() || dto.name.trim().length < 2) throw new BadRequestException('Informe o nome');
    const client = await this.clients.findOrCreateByPhone(t.id, { name: dto.name, phone: dto.phone, email: dto.email }, 'KIOSK');
    return { client: this.publicClient(client), ...(await this.state(t, client.id)) };
  }

  private async state(t: Tenant, clientId: string) {
    const today = nowLocalDate(t.timezone);
    const r = localDayRange(today, t.timezone);
    const [appointments, orders, upcoming] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId: t.id, clientId, deletedAt: null, startAt: { gte: r.start, lte: r.end }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } },
        include: { professional: { select: { id: true, name: true, avatarUrl: true, color: true } }, services: { include: { service: { select: { name: true } } } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { tenantId: t.id, clientId, status: 'OPEN', kind: 'CLIENT' },
        include: { items: { select: { id: true, description: true, quantity: true, unitPrice: true, total: true, type: true } }, payments: { select: { id: true, method: true, amount: true } } },
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.appointment.findFirst({ where: { tenantId: t.id, clientId, deletedAt: null, startAt: { gt: r.end }, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, orderBy: { startAt: 'asc' }, select: { id: true, startAt: true } }),
    ]);
    return {
      today,
      appointments: appointments.map((a) => ({ id: a.id, startAt: a.startAt, time: toLocalTime(a.startAt, t.timezone), status: a.status, checkedInAt: a.checkedInAt, professional: a.professional, services: a.services.map((s) => s.service.name), totalPrice: Number(a.totalPrice), prepaidAmount: Number(a.prepaidAmount), orderId: a.orderId })),
      openOrders: orders.map((o) => ({ id: o.id, number: o.number, total: Number(o.total), paidTotal: Number(o.paidTotal), remaining: money(Number(o.total) - Number(o.paidTotal)), items: o.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.total) })) })),
      nextAppointment: upcoming,
    };
  }

  /** Check-in: marca a chegada e avisa o profissional */
  async checkin(slug: string, token: string | undefined, appointmentId: string) {
    const t = await this.tenant(slug, token);
    const a = await this.prisma.appointment.findFirst({ where: { id: appointmentId, tenantId: t.id, deletedAt: null }, include: { client: true, professional: true, services: { include: { service: true } } } });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    if (!['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status)) throw new BadRequestException('Este agendamento não está ativo');
    if (a.checkedInAt) return { ok: true, already: true, checkedInAt: a.checkedInAt };
    const updated = await this.prisma.appointment.update({ where: { id: a.id }, data: { checkedInAt: new Date(), status: a.status === 'SCHEDULED' ? 'CONFIRMED' : a.status, confirmedAt: a.confirmedAt ?? new Date() } });
    // aviso ao profissional (WhatsApp) e registro
    const text = `💈 ${a.client?.name ?? a.guestName ?? 'Cliente'} chegou para ${a.services.map((s) => s.service.name).join(', ')} às ${toLocalTime(a.startAt, t.timezone)} (check-in no totem).`;
    this.messaging
      .send({ tenantId: t.id, clientId: a.clientId, kind: 'OTHER', channels: ['WHATSAPP'], phone: a.professional.phone, subject: 'Cliente chegou', text, appointmentId: a.id })
      .catch((e) => this.logger.warn(e.message));
    return { ok: true, already: false, checkedInAt: updated.checkedInAt };
  }

  /** Atendimento imediato: próximo horário livre hoje (qualquer profissional ou o escolhido) */
  async walkIn(slug: string, token: string | undefined, dto: { clientId: string; serviceIds: string[]; professionalId?: string }) {
    const t = await this.tenant(slug, token);
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, tenantId: t.id } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (!dto.serviceIds?.length) throw new BadRequestException('Escolha ao menos um serviço');
    const services = await this.prisma.service.findMany({ where: { tenantId: t.id, id: { in: dto.serviceIds }, isActive: true } });
    const duration = services.reduce((s, x) => s + x.durationMinutes, 0) || t.slotIntervalMin;
    const today = nowLocalDate(t.timezone);
    // sem regras de antecedência: o cliente está na loja
    const avail = await this.availability.forDate(t, today, duration, { professionalId: dto.professionalId, serviceIds: dto.serviceIds });
    const nowMin = (() => {
      const [h, m] = formatInTimeZone(new Date(), t.timezone, 'HH:mm').split(':').map(Number);
      return h * 60 + m;
    })();
    let best: { professionalId: string; time: string; minutes: number } | null = null;
    for (const a of avail) {
      for (const slot of a.slots) {
        const [h, m] = slot.split(':').map(Number);
        const min = h * 60 + m;
        if (min + 1 < nowMin) continue;
        if (!best || min < best.minutes) best = { professionalId: a.professionalId, time: slot, minutes: min };
      }
    }
    if (!best) throw new BadRequestException('Não há horário livre hoje. Fale com a recepção.');
    const r = await this.appointments.create(t.id, null, { professionalId: best.professionalId, clientId: client.id, serviceIds: dto.serviceIds, date: today, time: best.time, fitIn: true }, 'KIOSK');
    await this.prisma.appointment.update({ where: { id: r.appointment.id }, data: { checkedInAt: new Date(), status: 'CONFIRMED', confirmedAt: new Date() } });
    const pro = await this.prisma.professional.findUnique({ where: { id: best.professionalId } });
    const text = `💈 ${client.name} chegou sem hora marcada e foi encaixado às ${best.time} (${services.map((s) => s.name).join(', ')}).`;
    this.messaging.send({ tenantId: t.id, clientId: client.id, kind: 'OTHER', channels: ['WHATSAPP'], phone: pro?.phone, subject: 'Cliente na loja', text, appointmentId: r.appointment.id }).catch(() => undefined);
    return { appointment: { id: r.appointment.id, time: best.time, professional: pro ? { id: pro.id, name: pro.name, avatarUrl: pro.avatarUrl, color: pro.color } : null, waitMinutes: Math.max(0, best.minutes - nowMin) } };
  }

  /** Pagamento da comanda pelo totem: PIX (QR), POS (maquininha) ou COUNTER (balcão) */
  async pay(slug: string, token: string | undefined, orderId: string, method: 'PIX' | 'POS' | 'COUNTER') {
    const t = await this.tenant(slug, token);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: t.id, status: 'OPEN' }, include: { client: true } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    const remaining = money(Number(order.total) - Number(order.paidTotal));
    if (remaining <= 0) return { paid: true, remaining: 0 };
    if (method === 'COUNTER') {
      await this.prisma.order.update({ where: { id: orderId }, data: { notes: `${order.notes ? order.notes + '\n' : ''}Cliente optou por pagar no balcão (totem).` } });
      return { paid: false, counter: true, remaining };
    }
    const customer = order.client ?? { id: order.id, name: 'Cliente', email: null, phone: null };
    const intent = method === 'PIX' ? await this.payments.createCharge(t, { kind: 'PIX', amount: remaining, orderId, clientId: order.clientId ?? undefined, description: `Comanda #${order.number}`, customer }) : await this.payments.createPosCharge(t, { amount: remaining, orderId, clientId: order.clientId ?? undefined, description: `Comanda #${order.number}` });
    return { paid: false, remaining, intent: { id: intent.id, kind: intent.kind, qrCode: intent.qrCode, copyPaste: intent.copyPaste, expiresAt: intent.expiresAt, status: intent.status } };
  }

  /** Status da cobrança; ao ser paga, fecha a comanda automaticamente se houver caixa aberto */
  async paymentStatus(slug: string, token: string | undefined, intentId: string) {
    const t = await this.tenant(slug, token);
    const intent = await this.payments.getIntent(intentId, t.id);
    let closed = false;
    if (intent.status === 'PAID' && intent.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: intent.orderId } });
      if (order && order.status === 'OPEN' && Number(order.paidTotal) >= Number(order.total) - 0.009) {
        const session = await this.prisma.cashierSession.findFirst({ where: { tenantId: t.id, status: 'OPEN' } });
        if (session) {
          try {
            const owner = await this.prisma.membership.findFirst({ where: { tenantId: t.id, role: 'OWNER' } });
            await this.orders.close(t.id, { sub: owner?.userId ?? 'kiosk', email: '', name: 'Totem', isSuperAdmin: false, tenantId: t.id, role: 'OWNER' }, order.id, {});
            closed = true;
          } catch (e: any) {
            this.logger.warn(`Fechar comanda pelo totem: ${e.message}`);
          }
        }
      }
    }
    return { id: intent.id, status: intent.status, orderClosed: closed };
  }

  private publicClient(c: { id: string; name: string; phone: string | null; email: string | null; loyaltyPoints: number; visitsCount: number }) {
    return { id: c.id, name: c.name, firstName: c.name.split(' ')[0], phone: c.phone, email: c.email, loyaltyPoints: c.loyaltyPoints, visitsCount: c.visitsCount };
  }
}
