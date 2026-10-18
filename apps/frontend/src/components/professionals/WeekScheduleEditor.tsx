import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Switch, Tooltip } from '@/components/ui';
import { WEEKDAYS } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface TimeRange {
  start: string;
  end: string;
}

/** Índice = dia da semana (0 = domingo ... 6 = sábado) */
export type WeekRanges = TimeRange[][];

export const emptyWeek = (): WeekRanges => Array.from({ length: 7 }, () => []);

/** {"0":[{start,end}],...} -> WeekRanges */
export function weekFromRecord(rec: Record<string, TimeRange[]> | null | undefined): WeekRanges {
  const w = emptyWeek();
  if (!rec) return w;
  for (let d = 0; d <= 6; d++) w[d] = (rec[String(d)] ?? []).map((r) => ({ start: r.start, end: r.end }));
  return w;
}

export function weekToRecord(w: WeekRanges): Record<string, TimeRange[]> {
  const out: Record<string, TimeRange[]> = {};
  w.forEach((ranges, d) => (out[String(d)] = sortRanges(ranges)));
  return out;
}

/** [{weekday,startTime,endTime}] -> WeekRanges */
export function weekFromSchedules(rows: { weekday: number; startTime: string; endTime: string }[] | null | undefined): WeekRanges {
  const w = emptyWeek();
  for (const r of rows ?? []) if (r.weekday >= 0 && r.weekday <= 6) w[r.weekday].push({ start: r.startTime, end: r.endTime });
  return w.map(sortRanges);
}

export function weekToSchedules(w: WeekRanges) {
  return w.flatMap((ranges, weekday) => sortRanges(ranges).map((r) => ({ weekday, startTime: r.start, endTime: r.end })));
}

const sortRanges = (r: TimeRange[]) => [...r].sort((a, b) => a.start.localeCompare(b.start));

/** Retorna mensagem de erro (ou null) para a semana inteira */
export function validateWeek(w: WeekRanges): string | null {
  for (let d = 0; d <= 6; d++) {
    const ranges = sortRanges(w[d]);
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end)) return `${WEEKDAYS[d]}: preencha os horários`;
      if (r.start >= r.end) return `${WEEKDAYS[d]}: o início deve ser antes do fim (${r.start}–${r.end})`;
      if (i > 0 && r.start < ranges[i - 1].end) return `${WEEKDAYS[d]}: intervalos sobrepostos`;
    }
  }
  return null;
}

function nextRange(ranges: TimeRange[]): TimeRange {
  if (!ranges.length) return { start: '09:00', end: '18:00' };
  const last = sortRanges(ranges)[ranges.length - 1];
  const [h, m] = last.end.split(':').map(Number);
  const startMin = Math.min(h * 60 + m + 60, 23 * 60);
  const endMin = Math.min(startMin + 120, 23 * 60 + 59);
  const f = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  return { start: f(startMin), end: f(endMin) };
}

export function WeekScheduleEditor({
  value,
  onChange,
  disabled,
  closedLabel = 'Fechado',
  className,
}: {
  value: WeekRanges;
  onChange: (w: WeekRanges) => void;
  disabled?: boolean;
  closedLabel?: string;
  className?: string;
}) {
  const setDay = (d: number, ranges: TimeRange[]) => onChange(value.map((r, i) => (i === d ? ranges : r)));
  const copyToAll = (d: number) => onChange(value.map((r, i) => (i === d ? r : value[d].map((x) => ({ ...x })))));
  const copyToWeekdays = (d: number) => onChange(value.map((r, i) => (i === d || i === 0 || i === 6 ? r : value[d].map((x) => ({ ...x })))));

  return (
    <div className={cn('divide-y rounded-lg border', className)}>
      {WEEKDAYS.map((label, d) => {
        const ranges = value[d] ?? [];
        const open = ranges.length > 0;
        return (
          <div key={d} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
            <div className="flex w-full items-center gap-3 sm:w-40 sm:pt-1.5">
              <Switch checked={open} disabled={disabled} onCheckedChange={(c) => setDay(d, c ? [{ start: '09:00', end: '18:00' }] : [])} />
              <span className={cn('text-sm font-medium', !open && 'text-muted-foreground')}>{label}</span>
            </div>
            <div className="flex-1 space-y-2">
              {!open && <p className="text-sm text-muted-foreground sm:pt-1.5">{closedLabel}</p>}
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" className="w-28" value={r.start} disabled={disabled} onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <span className="text-sm text-muted-foreground">às</span>
                  <Input type="time" className="w-28" value={r.end} disabled={disabled} onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => setDay(d, ranges.filter((_, j) => j !== i))} aria-label="Remover intervalo">
                    <Trash2 className="text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-1 sm:pt-0.5">
              <Tooltip content="Adicionar intervalo">
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setDay(d, [...ranges, nextRange(ranges)])}>
                  <Plus /> <span className="sm:hidden lg:inline">Intervalo</span>
                </Button>
              </Tooltip>
              <Tooltip content="Copiar este dia para todos os outros">
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => copyToAll(d)}>
                  <Copy /> <span className="lg:inline hidden">Todos</span>
                </Button>
              </Tooltip>
              {d >= 1 && d <= 5 && (
                <Tooltip content="Copiar para segunda a sexta">
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => copyToWeekdays(d)}>
                    Seg–Sex
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WeekScheduleEditor;
