/**
 * Utilidades de fuso horário da agenda.
 * A API devolve instantes em UTC; a grade é exibida no fuso da barbearia (tenant.timezone).
 */
import type { AgendaData, AgendaProfessional } from '@/lib/api/appointments';
import { fromISODate } from '@/lib/utils/format';

export interface Interval {
  start: number; // minutos desde 00:00
  end: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }
    fmtCache.set(tz, f);
  }
  return f;
}

/** Instante -> data ("yyyy-MM-dd") e minutos do dia no fuso informado */
export function zoned(iso: string | Date, tz: string): { date: string; minutes: number; time: string } {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = Object.fromEntries(fmt(tz).formatToParts(d).map((p) => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  const m = Number(parts.minute);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: h * 60 + m, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

/** Data/hora de parede no fuso -> ISO UTC */
export function zonedToISO(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const z = zoned(new Date(guess), tz);
    const [zy, zmo, zd] = z.date.split('-').map(Number);
    const wall = Date.UTC(zy, zmo - 1, zd, Math.floor(z.minutes / 60), z.minutes % 60);
    const diff = wall - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess).toISOString();
}

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

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

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a)
    for (const y of b) {
      const s = Math.max(x.start, y.start);
      const e = Math.min(x.end, y.end);
      if (e > s) out.push({ start: s, end: e });
    }
  return out;
}

export function openingRanges(openingHours: AgendaData['openingHours'], weekday: number): Interval[] | null {
  if (!openingHours) return null;
  const r = openingHours[String(weekday)];
  if (!r) return null;
  return r.map((x) => ({ start: toMin(x.start), end: toMin(x.end) }));
}

/** Jornada efetiva do profissional na data (mesma regra do backend) */
export function workingFor(p: AgendaProfessional, date: string, openingHours: AgendaData['openingHours']): { working: Interval[]; off: boolean; reason?: string | null } {
  const weekday = fromISODate(date).getDay();
  const ov = p.scheduleOverrides?.find((o) => String(o.date).slice(0, 10) === date);
  if (ov?.type === 'OFF') return { working: [], off: true, reason: ov.reason };
  if (ov?.type === 'EXTRA' && ov.startTime && ov.endTime) return { working: mergeIntervals([{ start: toMin(ov.startTime), end: toMin(ov.endTime) }]), off: false, reason: ov.reason };
  let ranges = (p.workSchedules || []).filter((s) => s.weekday === weekday).map((s) => ({ start: toMin(s.startTime), end: toMin(s.endTime) }));
  const open = openingRanges(openingHours, weekday);
  if (open) ranges = intersect(ranges, open);
  const merged = mergeIntervals(ranges);
  return { working: merged, off: merged.length === 0 };
}

/** Hoje no fuso da barbearia */
export const todayIn = (tz: string) => zoned(new Date(), tz).date;
