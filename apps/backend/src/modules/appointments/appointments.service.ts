import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, MemberRole, Prisma, Tenant } from '@prisma/client';
import { addDays, addMonths, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { localDayRange, localToUtc, money, parseDateOnly, toLocalDate, toLocalTime } from '../../common/utils';
import { ClientsService } from '../clients/clients.service';
import { MessagingService, renderTemplate } from '../messaging/messaging.service';
import { ChangeStatusDto, CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';
import { AvailabilityService } from './availability.service';

const ACTIVE: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'];

export const DEFAULT_TEMPLATES = {
  confirmation:
    'Olá {{cliente}}! Seu horário na {{barbearia}} está marcado para {{data}} às {{hora}} com {{profissional}} ({{servicos}}). Até lá! 💈',
  reminder:
    'Olá {{cliente}}, lembrete do seu horário na {{barbearia}}: {{data}} às {{hora}} com {{profissional}} ({{servicos}}). Se precisar remarcar, responda esta mensagem.',
  cancellation: 'Olá {{cliente}}, seu horário de {{data}} às {{hora}} na {{barbearia}} foi cancelado. Para remarcar, acesse {{link}}.',
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private clients: ClientsService,
    private messaging: MessagingService,
  ) {}

  readonly include = {
    client: { select: { id: true, name: true, phone: true, email: true, avatarUrl: true, loyaltyPoints: true, visitsCount: true, noShowCount: true } },
    professional: { select: { id: true, name: true, color: true, avatarUrl: true } },
    services: { include: { service: { select: { id: true, name: true, color: true } } }, orderBy: { order: 'asc' as const } },
    order: { select: { id: true, number: true, status: true, total: true } },
  };

  // ------------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------------
  async agenda(tenantId: string, actor: AuthUser, from: string, to: string, professionalId?: string) {
    const tenant = await this.tenant(tenantId);
    const start = localDayRange(from, tenant.timezone).start;
    const end = localDayRange(to, tenant.timezone).end;
    const proFilter = this.scopeProfessional(actor, professionalId);
    const [appointments, blocks, professionals] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId, startAt: { lte: end }, endAt: { gte: start }, deletedAt: null, ...(proFilter ? { professionalId: proFilter } : {}) },
        include: this.include,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.scheduleBlock.findMany({
        where: { tenantId, startAt: { lte: end }, endAt: { gte: start }, ...(proFilter ? { OR: [{ professionalId: proFilter }, { professionalId: null }] } : {}) },
      }),
      this.prisma.professional.findMany({
        where: { tenantId, isActive: true, deletedAt: null, ...(proFilter ? { id: proFilter } : {}) },
        select: { id: true, name: true, color: true, avatarUrl: true, workSchedules: true, scheduleOverrides: { where: { date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } } } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return { appointments, blocks, professionals, timezone: tenant.timezone, openingHours: tenant.openingHours, slotIntervalMin: tenant.slotIntervalMin };
  }

  async list(tenantId: string, actor: AuthUser, q: { from?: string; to?: string; status?: string; clientId?: string; professionalId?: string; page?: string; limit?: string }) {
    const tenant = await this.tenant(tenantId);
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Number(q.limit) || 50);
    const proFilter = this.scopeProfessional(actor, q.professionalId);
    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(proFilter ? { professionalId: proFilter } : {}),
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(q.status ? { status: { in: q.status.split(',') as AppointmentStatus[] } } : {}),
      ...(q.from ? { startAt: { gte: localDayRange(q.from, tenant.timezone).start } } : {}),
      ...(q.to ? { endAt: { lte: localDayRange(q.to, tenant.timezone).end } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, include: this.include, orderBy: { startAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.appointment.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(tenantId: string, id: string, actor?: AuthUser) {
    const a = await this.prisma.appointment.findFirst({ where: { id, tenantId, deletedAt: null }, include: { ...this.include, recurrence: true } });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    if (actor && actor.role === MemberRole.PROFESSIONAL && a.professionalId !== actor.professionalId) {
      throw new ForbiddenException('Este agendamento é de outro profissional');
    }
    return a;
  }

  async availability(tenantId: string, q: { date: string; professionalId?: string; serviceIds?: string; durationMinutes?: string; ignoreAppointmentId?: string }) {
    const tenant = await this.tenant(tenantId);
    const serviceIds = q.serviceIds ? q.serviceIds.split(',').filter(Boolean) : [];
    let duration = Number(q.durationMinutes) || 0;
    if (!duration && serviceIds.length) duration = await this.servicesDuration(tenantId, serviceIds);
    if (!duration) duration = tenant.slotIntervalMin;
    return this.availabilityService.forDate(tenant, q.date, duration, { professionalId: q.professionalId, serviceIds, ignoreAppointmentId: q.ignoreAppointmentId });
  }

  // ------------------------------------------------------------------
  // Criação
  // ------------------------------------------------------------------
  async create(tenantId: string, actor: AuthUser | null, dto: CreateAppointmentDto, source: AppointmentSource = 'ADMIN') {
    const tenant = await this.tenant(tenantId);
    if (actor?.role === MemberRole.PROFESSIONAL && dto.professionalId !== actor.professionalId) {
      throw new ForbiddenException('Você só pode agendar na própria agenda');
    }
    const professional = await this.prisma.professional.findFirst({ where: { id: dto.professionalId, tenantId, isActive: true, deletedAt: null } });
    if (!professional) throw new NotFoundException('Profissional não encontrado');

    const services = await this.resolveServices(tenantId, dto.serviceIds, professional.id);
    const duration = dto.durationMinutes ?? services.reduce((s, x) => s + x.durationMinutes, 0);
    const totalPrice = money(services.reduce((s, x) => s + Number(x.price), 0));
    const startAt = localToUtc(dto.date, dto.time, tenant.timezone);
    const endAt = new Date(startAt.getTime() + duration * 60000);

    const online = source === 'SITE' || source === 'CLIENT';
    if (!dto.fitIn) {
      const check = await this.availabilityService.check(tenant, professional.id, startAt, endAt, { onlineRules: online });
      if (!check.ok) throw new BadRequestException(check.reason);
    } else if (online) {
      throw new ForbiddenException('Encaixe só pode ser feito pela barbearia');
    }

    // cliente
    let clientId = dto.clientId ?? null;
    if (!clientId && dto.clientName) {
      const c = await this.clients.findOrCreateByPhone(tenantId, { name: dto.clientName, phone: dto.clientPhone, email: dto.clientEmail }, online ? 'SITE' : 'ADMIN');
      clientId = c.id;
    }
    if (clientId) {
      const c = await this.prisma.client.findFirst({ where: { id: clientId, tenantId, deletedAt: null } });
      if (!c) throw new NotFoundException('Cliente não encontrado');
      if (c.blocked && online) throw new ForbiddenException('Não foi possível agendar. Entre em contato com a barbearia.');
    }

    const status: AppointmentStatus = dto.status ?? (online ? (tenant.autoConfirm ? 'CONFIRMED' : 'SCHEDULED') : 'CONFIRMED');

    // recorrência
    let recurrenceId: string | undefined;
    const dates: Date[] = [startAt];
    if (dto.recurrence && !online) {
      const rec = await this.prisma.appointmentRecurrence.create({
        data: {
          tenantId,
          frequency: dto.recurrence.frequency,
          startsOn: parseDateOnly(dto.date),
          endsOn: dto.recurrence.endsOn ? parseDateOnly(dto.recurrence.endsOn) : null,
          occurrences: dto.recurrence.occurrences ?? 12,
        },
      });
      recurrenceId = rec.id;
      const max = dto.recurrence.occurrences ?? 12;
      const endsOn = dto.recurrence.endsOn ? parseDateOnly(dto.recurrence.endsOn) : null;
      let cursor = startAt;
      for (let i = 1; i < max; i++) {
        cursor = dto.recurrence.frequency === 'WEEKLY' ? addWeeks(cursor, 1) : dto.recurrence.frequency === 'BIWEEKLY' ? addWeeks(cursor, 2) : addMonths(cursor, 1);
        if (endsOn && cursor > addDays(endsOn, 1)) break;
        dates.push(cursor);
      }
    }

    const created = [] as any[];
    const skipped: string[] = [];
    for (const [i, s] of dates.entries()) {
      const e = new Date(s.getTime() + duration * 60000);
      if (i > 0 && !dto.fitIn) {
        const check = await this.availabilityService.check(tenant, professional.id, s, e);
        if (!check.ok) {
          skipped.push(`${toLocalDate(s, tenant.timezone)} ${toLocalTime(s, tenant.timezone)}: ${check.reason}`);
          continue;
        }
      }
      const a = await this.prisma.appointment.create({
        data: {
          tenantId,
          clientId,
          professionalId: professional.id,
          startAt: s,
          endAt: e,
          status,
          source: i > 0 ? 'RECURRING' : source,
          isFitIn: !!dto.fitIn,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          guestName: !clientId ? dto.clientName : undefined,
          guestPhone: !clientId ? dto.clientPhone : undefined,
          totalPrice,
          totalDuration: duration,
          recurrenceId,
          confirmedAt: status === 'CONFIRMED' ? new Date() : null,
          createdById: actor?.sub,
          services: { create: services.map((sv, idx) => ({ serviceId: sv.id, price: sv.price, durationMinutes: sv.durationMinutes, order: idx })) },
        },
        include: this.include,
      });
      created.push(a);
    }
    if (created.length === 0) throw new BadRequestException(skipped[0] || 'Não foi possível agendar');

    // confirmação
    this.notify(tenant, created[0], 'CONFIRMATION').catch((e) => this.logger.warn(e.message));

    // lista de espera: marca como atendido se o cliente estava na lista daquele dia
    if (clientId) {
      await this.prisma.waitlistEntry.updateMany({
        where: { tenantId, clientId, date: parseDateOnly(dto.date), status: { in: ['WAITING', 'NOTIFIED'] } },
        data: { status: 'BOOKED' },
      });
    }

    return { appointment: created[0], created: created.length, skipped };
  }

  // ------------------------------------------------------------------
  // Alteração / status
  // ------------------------------------------------------------------
  async update(tenantId: string, actor: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const tenant = await this.tenant(tenantId);
    const current = await this.get(tenantId, id, actor);
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new BadRequestException('Agendamento finalizado ou cancelado não pode ser alterado');
    }
    if (actor.role === MemberRole.PROFESSIONAL && dto.professionalId && dto.professionalId !== actor.professionalId) {
      throw new ForbiddenException('Você não pode transferir para outro profissional');
    }
    const professionalId = dto.professionalId ?? current.professionalId;
    let services = current.services.map((s) => ({ id: s.serviceId, price: s.price, durationMinutes: s.durationMinutes }));
    if (dto.serviceIds) services = await this.resolveServices(tenantId, dto.serviceIds, professionalId);
    const duration = dto.durationMinutes ?? (dto.serviceIds ? services.reduce((s, x) => s + x.durationMinutes, 0) : current.totalDuration);
    const date = dto.date ?? toLocalDate(current.startAt, tenant.timezone);
    const time = dto.time ?? toLocalTime(current.startAt, tenant.timezone);
    const startAt = localToUtc(date, time, tenant.timezone);
    const endAt = new Date(startAt.getTime() + duration * 60000);
    const fitIn = dto.fitIn ?? current.isFitIn;
    if (!fitIn) {
      const check = await this.availabilityService.check(tenant, professionalId, startAt, endAt, { ignoreAppointmentId: id });
      if (!check.ok) throw new BadRequestException(check.reason);
    }
    const moved = startAt.getTime() !== current.startAt.getTime() || professionalId !== current.professionalId;
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        professionalId,
        clientId: dto.clientId === undefined ? undefined : dto.clientId,
        startAt,
        endAt,
        isFitIn: fitIn,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
        totalDuration: duration,
        totalPrice: money(services.reduce((s, x) => s + Number(x.price), 0)),
        reminderSentAt: moved ? null : undefined,
        ...(dto.serviceIds
          ? { services: { deleteMany: {}, create: services.map((sv, idx) => ({ serviceId: sv.id, price: sv.price, durationMinutes: sv.durationMinutes, order: idx })) } }
          : {}),
      },
      include: this.include,
    });
    if (moved) this.notify(tenant, updated, 'CONFIRMATION').catch((e) => this.logger.warn(e.message));
    return updated;
  }

  async changeStatus(tenantId: string, actor: AuthUser | null, id: string, dto: ChangeStatusDto, by: 'STAFF' | 'CLIENT' = 'STAFF') {
    const tenant = await this.tenant(tenantId);
    const a = await this.get(tenantId, id, actor ?? undefined);
    const next = dto.status;
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'CONFIRMED'],
      COMPLETED: ['CONFIRMED'],
      CANCELLED: ['SCHEDULED', 'CONFIRMED'],
      NO_SHOW: ['CONFIRMED', 'COMPLETED'],
    };
    if (!allowed[a.status].includes(next)) throw new BadRequestException(`Não é possível mudar de ${a.status} para ${next}`);
    if (by === 'CLIENT') {
      if (next !== 'CANCELLED') throw new ForbiddenException('Operação não permitida');
      const limit = new Date(a.startAt.getTime() - tenant.cancelLimitHours * 3600000);
      if (new Date() > limit) throw new BadRequestException(`Cancelamento online permitido até ${tenant.cancelLimitHours}h antes. Fale com a barbearia.`);
    }
    if (a.status === 'COMPLETED' && a.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: a.orderId } });
      if (order?.status === 'CLOSED') throw new BadRequestException('A comanda deste agendamento já foi fechada');
    }
    const data: Prisma.AppointmentUpdateInput = { status: next };
    if (next === 'CONFIRMED') data.confirmedAt = new Date();
    if (next === 'IN_PROGRESS') data.startedAt = new Date();
    if (next === 'COMPLETED') data.completedAt = new Date();
    if (next === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancelReason = dto.reason;
      data.cancelledBy = by;
    }
    const updated = await this.prisma.appointment.update({ where: { id }, data, include: this.include });

    if (next === 'NO_SHOW' && a.clientId) {
      await this.prisma.client.update({ where: { id: a.clientId }, data: { noShowCount: { increment: 1 } } });
    }
    if (next === 'CANCELLED') {
      if (dto.cancelSeries && a.recurrenceId) {
        await this.prisma.appointment.updateMany({
          where: { recurrenceId: a.recurrenceId, startAt: { gt: a.startAt }, status: { in: ACTIVE } },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.reason, cancelledBy: by },
        });
        await this.prisma.appointmentRecurrence.update({ where: { id: a.recurrenceId }, data: { isActive: false } });
      }
      if (by === 'STAFF') this.notify(tenant, updated, 'CANCELLATION').catch((e) => this.logger.warn(e.message));
      // avisa lista de espera do dia
      this.notifyWaitlist(tenant, updated).catch((e) => this.logger.warn(e.message));
    }
    return updated;
  }

  async remove(tenantId: string, actor: AuthUser, id: string) {
    const a = await this.get(tenantId, id, actor);
    if (a.orderId) throw new BadRequestException('Agendamento com comanda não pode ser excluído; cancele-o');
    await this.prisma.appointment.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Mensagens
  // ------------------------------------------------------------------
  async notify(tenant: Tenant, a: any, kind: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION') {
    const client = a.client ?? (a.clientId ? await this.prisma.client.findUnique({ where: { id: a.clientId } }) : null);
    const phone = client?.phone ?? a.guestPhone;
    const email = client?.email;
    if (!phone && !email) return;
    const settings = (tenant.settings as any) || {};
    const templates = { ...DEFAULT_TEMPLATES, ...(settings.templates || {}) };
    const channels = ((tenant.reminderChannels as string[]) || ['WHATSAPP', 'EMAIL']) as any[];
    const vars = this.vars(tenant, a, client);
    const text = renderTemplate(templates[kind.toLowerCase()], vars);
    const subjects = { CONFIRMATION: 'Agendamento confirmado', REMINDER: 'Lembrete do seu horário', CANCELLATION: 'Agendamento cancelado' };
    await this.messaging.send({
      tenantId: tenant.id,
      clientId: client?.id,
      kind,
      channels,
      phone,
      email,
      subject: `${subjects[kind]} - ${tenant.name}`,
      text,
      appointmentId: a.id,
    });
  }

  vars(tenant: Tenant, a: any, client: any) {
    const tz = tenant.timezone;
    return {
      cliente: (client?.name ?? a.guestName ?? 'cliente').split(' ')[0],
      barbearia: tenant.name,
      data: formatInTimeZone(a.startAt, tz, 'dd/MM/yyyy'),
      hora: formatInTimeZone(a.startAt, tz, 'HH:mm'),
      profissional: a.professional?.name ?? '',
      servicos: (a.services || []).map((s: any) => s.service?.name).filter(Boolean).join(', '),
      link: `${this.messaging.appUrl()}/b/${tenant.slug}`,
      endereco: [tenant.addressStreet, tenant.addressNumber, tenant.addressDistrict].filter(Boolean).join(', '),
    };
  }

  private async notifyWaitlist(tenant: Tenant, a: any) {
    const date = parseDateOnly(toLocalDate(a.startAt, tenant.timezone));
    const entries = await this.prisma.waitlistEntry.findMany({
      where: { tenantId: tenant.id, date, status: 'WAITING', OR: [{ professionalId: null }, { professionalId: a.professionalId }] },
      include: { client: true },
      take: 5,
    });
    for (const e of entries) {
      const text = `Olá ${e.client.name.split(' ')[0]}! Vagou um horário na ${tenant.name} em ${formatInTimeZone(a.startAt, tenant.timezone, 'dd/MM')} às ${formatInTimeZone(a.startAt, tenant.timezone, 'HH:mm')}. Agende agora: ${this.messaging.appUrl()}/b/${tenant.slug}`;
      await this.messaging.send({ tenantId: tenant.id, clientId: e.clientId, kind: 'WAITLIST', channels: ['WHATSAPP', 'EMAIL'], phone: e.client.phone, email: e.client.email, subject: `Vagou um horário - ${tenant.name}`, text });
      await this.prisma.waitlistEntry.update({ where: { id: e.id }, data: { status: 'NOTIFIED', notifiedAt: new Date() } });
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  async tenant(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  }

  private scopeProfessional(actor: AuthUser, requested?: string) {
    if (actor.role === MemberRole.PROFESSIONAL) return actor.professionalId ?? '__none__';
    return requested || undefined;
  }

  private async servicesDuration(tenantId: string, serviceIds: string[]) {
    const list = await this.prisma.service.findMany({ where: { tenantId, id: { in: serviceIds } } });
    return list.reduce((s, x) => s + x.durationMinutes, 0);
  }

  async resolveServices(tenantId: string, serviceIds: string[], professionalId: string) {
    const list = await this.prisma.service.findMany({
      where: { tenantId, id: { in: serviceIds }, deletedAt: null },
      include: { professionals: { where: { professionalId } } },
    });
    if (list.length !== new Set(serviceIds).size) throw new BadRequestException('Serviço inválido');
    return serviceIds.map((id) => {
      const s = list.find((x) => x.id === id)!;
      const custom = s.professionals[0];
      return { id: s.id, name: s.name, price: custom?.price ?? s.price, durationMinutes: custom?.durationMinutes ?? s.durationMinutes };
    });
  }
}
