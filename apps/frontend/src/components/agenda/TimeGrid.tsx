import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Lock, Repeat, Zap } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import type { AgendaAppointment, AgendaBlock } from '@/lib/api/appointments';
import { STATUS_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { toHHMM, zoned, type Interval } from './tz';

export interface GridColumn {
  key: string;
  date: string;
  professionalId: string;
  header: ReactNode;
  working: Interval[];
  off: boolean;
  isToday: boolean;
}

export const STATUS_DOT: Record<string, string> = {
  SCHEDULED: 'bg-sky-500',
  CONFIRMED: 'bg-emerald-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-gray-400',
  CANCELLED: 'bg-red-500',
  NO_SHOW: 'bg-rose-500',
};

/** "#rrggbb" + alpha -> rgba() */
export function tint(hex: string | null | undefined, alpha: number) {
  const h = (hex || '#f59e0b').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(245,158,11,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const HATCH = 'repeating-linear-gradient(45deg, rgba(100,116,139,0.22) 0 6px, rgba(100,116,139,0.06) 6px 12px)';

interface Placed<T> {
  item: T;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** distribui itens sobrepostos lado a lado */
function layout<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

export function TimeGrid({
  columns,
  appointments,
  blocks,
  timezone,
  interval,
  range,
  onSlotClick,
  onAppointmentClick,
  onBlockClick,
}: {
  columns: GridColumn[];
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  timezone: string;
  interval: number;
  range: Interval;
  onSlotClick: (date: string, time: string, professionalId: string) => void;
  onAppointmentClick: (a: AgendaAppointment) => void;
  onBlockClick: (b: AgendaBlock) => void;
}) {
  const step = Math.max(5, interval || 15);
  const rowH = step <= 10 ? 18 : step <= 15 ? 24 : step <= 30 ? 36 : 56;
  const ppm = rowH / step;
  const rows = useMemo(() => {
    const r: number[] = [];
    for (let m = range.start; m < range.end; m += step) r.push(m);
    return r;
  }, [range.start, range.end, step]);
  const height = rows.length * rowH;

  // "agora"
  const [now, setNow] = useState(() => zoned(new Date(), timezone));
  useEffect(() => {
    const t = setInterval(() => setNow(zoned(new Date(), timezone)), 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  // rola até o horário atual na primeira renderização
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasToday = columns.some((c) => c.isToday);
    if (hasToday && now.minutes > range.start && now.minutes < range.end) el.scrollTop = Math.max(0, (now.minutes - range.start) * ppm - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, range.start]);

  // posicionamento por coluna
  const perColumn = useMemo(() => {
    const map = new Map<string, { appts: Placed<AgendaAppointment>[]; blocks: { b: AgendaBlock; start: number; end: number }[] }>();
    for (const col of columns) {
      const appts = appointments
        .filter((a) => a.professionalId === col.professionalId)
        .map((a) => {
          const s = zoned(a.startAt, timezone);
          const e = zoned(a.endAt, timezone);
          if (s.date > col.date || e.date < col.date) return null;
          const start = s.date < col.date ? 0 : s.minutes;
          const end = e.date > col.date ? 24 * 60 : e.minutes;
          return { item: a, start, end: Math.max(end, start + 10) };
        })
        .filter(Boolean) as { item: AgendaAppointment; start: number; end: number }[];
      const bl = blocks
        .filter((b) => !b.professionalId || b.professionalId === col.professionalId)
        .map((b) => {
          const s = zoned(b.startAt, timezone);
          const e = zoned(b.endAt, timezone);
          if (s.date > col.date || e.date < col.date) return null;
          return { b, start: s.date < col.date ? 0 : s.minutes, end: e.date > col.date ? 24 * 60 : e.minutes };
        })
        .filter(Boolean) as { b: AgendaBlock; start: number; end: number }[];
      map.set(col.key, { appts: layout(appts), blocks: bl });
    }
    return map;
  }, [columns, appointments, blocks, timezone]);

  const clampTop = (m: number) => (Math.max(m, range.start) - range.start) * ppm;
  const clampH = (s: number, e: number) => Math.max(14, (Math.min(e, range.end) - Math.max(s, range.start)) * ppm);
  const inWorking = (col: GridColumn, m: number) => col.working.some((w) => w.start <= m && m < w.end);

  return (
    <div ref={scrollRef} className="relative max-h-[calc(100vh-15rem)] min-h-[420px] overflow-auto rounded-xl border bg-background scrollbar-thin">
      <div className="flex min-w-fit">
        {/* coluna de horas */}
        <div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-background">
          <div className="sticky top-0 z-30 h-14 border-b bg-background" />
          <div className="relative" style={{ height }}>
            {rows.map((m, i) => (
              <div key={m} className="absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums" style={{ top: i * rowH }}>
                {i > 0 && (m % 60 === 0 ? <span className="font-medium text-foreground">{toHHMM(m)}</span> : step >= 30 ? <span className="text-muted-foreground">{toHHMM(m)}</span> : null)}
              </div>
            ))}
          </div>
        </div>

        {columns.map((col) => {
          const data = perColumn.get(col.key);
          return (
            <div key={col.key} className="min-w-[150px] flex-1 border-r last:border-r-0">
              {/* cabeçalho */}
              <div className={cn('sticky top-0 z-10 flex h-14 items-center justify-center border-b bg-background px-2', col.isToday && 'bg-amber-50')}>{col.header}</div>
              {/* corpo */}
              <div className="relative" style={{ height }}>
                {rows.map((m, i) => {
                  const working = !col.off && inWorking(col, m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onSlotClick(col.date, toHHMM(m), col.professionalId)}
                      className={cn(
                        'group absolute inset-x-0 block border-t text-left transition-colors',
                        m % 60 === 0 ? 'border-border' : 'border-dashed border-border/50',
                        working ? 'bg-background hover:bg-amber-50' : 'bg-muted/70 hover:bg-muted',
                      )}
                      style={{ top: i * rowH, height: rowH }}
                      title={`${toHHMM(m)}${working ? '' : ' (fora da jornada)'}`}
                    >
                      <span className="hidden pl-1.5 text-[10px] font-medium text-amber-700 group-hover:inline">+ {toHHMM(m)}</span>
                    </button>
                  );
                })}

                {/* bloqueios */}
                {data?.blocks
                  .filter((x) => x.end > range.start && x.start < range.end)
                  .map(({ b, start, end }) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick(b);
                      }}
                      className="absolute inset-x-0 z-[5] flex items-start gap-1 overflow-hidden border-y border-slate-300 px-1.5 py-0.5 text-left text-[11px] font-medium text-slate-600"
                      style={{ top: clampTop(start), height: clampH(start, end), backgroundImage: HATCH }}
                    >
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {b.reason || 'Bloqueado'}
                        {!b.professionalId && ' (todos)'}
                      </span>
                    </button>
                  ))}

                {/* agendamentos */}
                {data?.appts
                  .filter((x) => x.end > range.start && x.start < range.end)
                  .map(({ item: a, start, end, lane, lanes }) => {
                    const color = a.professional?.color || '#f59e0b';
                    const h = clampH(start, end);
                    const name = a.client?.name ?? a.guestName ?? 'Sem cliente';
                    const services = a.services.map((s) => s.service.name).join(', ');
                    const faded = a.status === 'CANCELLED' || a.status === 'NO_SHOW';
                    return (
                      <Tooltip key={a.id} content={`${toHHMM(start)}–${toHHMM(end)} · ${name} · ${services} · ${STATUS_LABEL[a.status]}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(a);
                          }}
                          className={cn('absolute z-[6] overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition hover:z-[7] hover:shadow-md', faded && 'opacity-60')}
                          style={{
                            top: clampTop(start) + 1,
                            height: h - 2,
                            left: `calc(${(lane / lanes) * 100}% + 2px)`,
                            width: `calc(${100 / lanes}% - 4px)`,
                            backgroundColor: tint(color, 0.16),
                            borderColor: tint(color, 0.45),
                            borderLeft: `4px solid ${color}`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[a.status])} />
                            <span className="font-semibold tabular-nums">{toHHMM(start)}</span>
                            {a.isFitIn && <Zap className="h-3 w-3 shrink-0 text-amber-600" />}
                            {a.recurrenceId && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            {a.orderId && <span className="ml-auto shrink-0 rounded bg-white/70 px-1 text-[9px] font-semibold">CMD</span>}
                          </div>
                          <div className={cn('truncate font-semibold', a.status === 'CANCELLED' && 'line-through')}>{name}</div>
                          {h > 44 && <div className="truncate text-muted-foreground">{services}</div>}
                          {h > 60 && <div className="truncate text-[10px] text-muted-foreground">{STATUS_LABEL[a.status]}</div>}
                        </button>
                      </Tooltip>
                    );
                  })}

                {/* linha do agora */}
                {col.isToday && now.minutes >= range.start && now.minutes <= range.end && (
                  <div className="pointer-events-none absolute inset-x-0 z-[8] flex items-center" style={{ top: (now.minutes - range.start) * ppm }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TimeGrid;
