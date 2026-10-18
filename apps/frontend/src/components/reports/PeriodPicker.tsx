import { useState } from 'react';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { CalendarRange } from 'lucide-react';
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtDate, toISODate } from '@/lib/utils/format';
import type { Period } from '@/lib/api/reports';

export type PeriodPreset = 'today' | 'week' | 'month' | 'last30' | 'lastMonth' | 'custom';

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'last30', label: '30 dias' },
  { key: 'lastMonth', label: 'Mês passado' },
];

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, base = new Date()): Period {
  switch (preset) {
    case 'today':
      return { from: toISODate(base), to: toISODate(base) };
    case 'week':
      return { from: toISODate(startOfWeek(base, { weekStartsOn: 0 })), to: toISODate(endOfWeek(base, { weekStartsOn: 0 })) };
    case 'month':
      return { from: toISODate(startOfMonth(base)), to: toISODate(endOfMonth(base)) };
    case 'last30':
      return { from: toISODate(subDays(base, 29)), to: toISODate(base) };
    case 'lastMonth': {
      const m = subMonths(base, 1);
      return { from: toISODate(startOfMonth(m)), to: toISODate(endOfMonth(m)) };
    }
  }
}

export interface PeriodState extends Period {
  preset: PeriodPreset;
}

/** Estado de período reutilizável */
export function usePeriod(initial: Exclude<PeriodPreset, 'custom'> = 'month') {
  const [period, setPeriod] = useState<PeriodState>(() => ({ preset: initial, ...presetRange(initial) }));
  return [period, setPeriod] as const;
}

export function periodLabel(p: Period) {
  return p.from === p.to ? fmtDate(p.from + 'T12:00:00') : `${fmtDate(p.from + 'T12:00:00')} a ${fmtDate(p.to + 'T12:00:00')}`;
}

export function PeriodPicker({ value, onChange, className, presets = ['today', 'week', 'month', 'last30'] }: { value: PeriodState; onChange: (p: PeriodState) => void; className?: string; presets?: Exclude<PeriodPreset, 'custom'>[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Period>({ from: value.from, to: value.to });

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="inline-flex rounded-lg border bg-background p-0.5">
        {PRESETS.filter((p) => presets.includes(p.key)).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ preset: p.key, ...presetRange(p.key) })}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', value.preset === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setDraft({ from: value.from, to: value.to });
        }}
      >
        <PopoverTrigger asChild>
          <Button variant={value.preset === 'custom' ? 'default' : 'outline'} size="sm" className="h-8">
            <CalendarRange />
            {periodLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!draft.from || !draft.to || draft.from > draft.to}
            onClick={() => {
              onChange({ preset: 'custom', ...draft });
              setOpen(false);
            }}
          >
            Aplicar período
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default PeriodPicker;
