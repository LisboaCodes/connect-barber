import { Injectable } from '@nestjs/common';
import { Professional, Tenant, WorkSchedule } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import {
  localDayRange,
  localToUtc,
  localWeekday,
  minutesToTime,
  parseDateOnly,
  timeToMinutes,
  toLocalDate,
  toLocalTime,
} from '../../common/utils';

export interface Interval {
  start: number; // minutos desde 00:00 local
  end: number;
}

export interface DayAvailability {
  professionalId: string;
  professionalName: string;
  color: string;
  working: Interval[];      // jornada efetiva do dia (já descontando folga/override)
  busy: Interval[];         // agendamentos + bloqueios
  slots: string[];          // horários livres "HH:mm" para a duração pedida
  off: boolean;             // folga no dia
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula a disponibilidade de um ou mais profissionais em uma data.
   * @param durationMinutes duração total dos serviços
   * @param onlineRules aplica antecedência mínima/máxima e só profissionais com agendamento online
   */
  async forDate(
    tenant: Tenant,
    dateStr: string,
    durationMinutes: number,
    opts: { professionalId?: string; serviceIds?: string[]; onlineRules?: boolean; ignoreAppointmentId?: string } = {},
  ): Promise<DayAvailability[]> {
    const tz = tenant.timezone;
    const date = parseDateOnly(dateStr);
    const { start: dayStart, end: dayEnd } = localDayRange(dateStr, tz);
    const weekday = localWeekday(localToUtc(dateStr, '12:00', tz), tz);

    const professionals = await this.prisma.professional.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        deletedAt: null,
        ...(opts.professionalId ? { id: opts.professionalId } : {}),
        ...(opts.onlineRules ? { acceptsOnlineBooking: true } : {}),
        ...(opts.serviceIds?.length
          ? {
              // profissionais que executam TODOS os serviços (ou sem restrição cadastrada)
              AND: opts.serviceIds.map((serviceId) => ({
                OR: [{ services: { none: {} } }, { services: { some: { serviceId } } }],
              })),
            }
          : {}),
      },
      include: {
        workSchedules: { where: { weekday } },
        scheduleOverrides: { where: { date } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    if (professionals.length === 0) return [];

    const ids = professionals.map((p) => p.id);
    const [appointments, blocks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          tenantId: tenant.id,
          professionalId: { in: ids },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
          deletedAt: null,
          ...(opts.ignoreAppointmentId ? { NOT: { id: opts.ignoreAppointmentId } } : {}),
        },
        select: { professionalId: true, startAt: true, endAt: true },
      }),
      this.prisma.scheduleBlock.findMany({
        where: { tenantId: tenant.id, startAt: { lt: dayEnd }, endAt: { gt: dayStart }, OR: [{ professionalId: null }, { professionalId: { in: ids } }] },
        select: { professionalId: true, startAt: true, endAt: true },
      }),
    ]);

    const openRanges = this.openingRanges(tenant, weekday);
    const now = new Date();
    const minStart = opts.onlineRules ? new Date(now.getTime() + tenant.minAdvanceMin * 60000) : now;
    const maxDate = opts.onlineRules ? new Date(now.getTime() + tenant.maxAdvanceDays * 86400000) : null;
    const step = tenant.slotIntervalMin || 15;

    const toLocal = (d: Date) => {
      // minutos locais, com clamp ao dia
      if (d <= dayStart) return 0;
      if (d >= dayEnd) return 24 * 60;
      return timeToMinutes(toLocalTime(d, tz));
    };

    return professionals.map((p) => {
      const { working, off } = this.workingIntervals(p, p.workSchedules, p.scheduleOverrides, openRanges);
      const busy: Interval[] = [
        ...appointments.filter((a) => a.professionalId === p.id).map((a) => ({ start: toLocal(a.startAt), end: toLocal(a.endAt) })),
        ...blocks.filter((b) => !b.professionalId || b.professionalId === p.id).map((b) => ({ start: toLocal(b.startAt), end: toLocal(b.endAt) })),
      ];
      const slots: string[] = [];
      if (!off && !(maxDate && dayStart > maxDate)) {
        for (const w of working) {
          for (let t = w.start; t + durationMinutes <= w.end; t += step) {
            const end = t + durationMinutes;
            const overlaps = busy.some((b) => b.start < end && b.end > t);
            if (overlaps) continue;
            const startUtc = localToUtc(dateStr, minutesToTime(t), tz);
            if (startUtc < minStart) continue;
            slots.push(minutesToTime(t));
          }
        }
      }
      return { professionalId: p.id, professionalName: p.name, color: p.color, working, busy, slots, off };
    });
  }

  /** Jornada efetiva no dia: override > jornada semanal, limitada ao horário da barbearia */
  workingIntervals(
    _p: Professional,
    schedules: WorkSchedule[],
    overrides: { type: string; startTime: string | null; endTime: string | null }[],
    openRanges: Interval[] | null,
  ): { working: Interval[]; off: boolean } {
    const ov = overrides[0];
    if (ov?.type === 'OFF') return { working: [], off: true };
    let ranges: Interval[];
    if (ov?.type === 'EXTRA' && ov.startTime && ov.endTime) {
      ranges = [{ start: timeToMinutes(ov.startTime), end: timeToMinutes(ov.endTime) }];
      // jornada específica ignora o horário padrão da barbearia
      return { working: mergeIntervals(ranges), off: false };
    }
    ranges = schedules.map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }));
    if (openRanges) ranges = intersect(ranges, openRanges);
    const merged = mergeIntervals(ranges);
    return { working: merged, off: merged.length === 0 };
  }

  openingRanges(tenant: Tenant, weekday: number): Interval[] | null {
    const oh = tenant.openingHours as Record<string, { start: string; end: string }[]> | null;
    if (!oh) return null;
    const ranges = oh[String(weekday)];
    if (!ranges) return null;
    return ranges.map((r) => ({ start: timeToMinutes(r.start), end: timeToMinutes(r.end) }));
  }

  /** Verifica se o intervalo cabe na jornada e não colide (usado ao criar/mover) */
  async check(
    tenant: Tenant,
    professionalId: string,
    startAt: Date,
    endAt: Date,
    opts: { ignoreAppointmentId?: string; onlineRules?: boolean } = {},
  ): Promise<{ ok: boolean; reason?: string }> {
    const tz = tenant.timezone;
    const dateStr = toLocalDate(startAt, tz);
    const avail = await this.forDate(tenant, dateStr, 1, { professionalId, onlineRules: opts.onlineRules, ignoreAppointmentId: opts.ignoreAppointmentId });
    const a = avail[0];
    if (!a) return { ok: false, reason: 'Profissional indisponível para agendamento' };
    if (a.off) return { ok: false, reason: 'O profissional está de folga neste dia' };
    const s = timeToMinutes(toLocalTime(startAt, tz));
    const e = s + Math.round((endAt.getTime() - startAt.getTime()) / 60000);
    const inside = a.working.some((w) => w.start <= s && e <= w.end);
    if (!inside) return { ok: false, reason: 'Horário fora da jornada de trabalho do profissional' };
    const collide = a.busy.some((b) => b.start < e && b.end > s);
    if (collide) return { ok: false, reason: 'Já existe um agendamento ou bloqueio neste horário' };
    if (opts.onlineRules) {
      if (startAt < new Date(Date.now() + tenant.minAdvanceMin * 60000)) return { ok: false, reason: 'Horário muito próximo; escolha outro' };
      if (startAt > new Date(Date.now() + tenant.maxAdvanceDays * 86400000)) return { ok: false, reason: 'Data além do limite de agendamento' };
    }
    return { ok: true };
  }
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) for (const y of b) {
    const s = Math.max(x.start, y.start);
    const e = Math.min(x.end, y.end);
    if (e > s) out.push({ start: s, end: e });
  }
  return out;
}
