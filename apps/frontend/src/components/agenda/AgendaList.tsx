import { CalendarX2, Lock, Repeat, Zap } from 'lucide-react';
import { Badge, Button, EmptyState } from '@/components/ui';
import type { AgendaAppointment, AgendaBlock } from '@/lib/api/appointments';
import { fmtDay, fromISODate, money, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { zoned } from './tz';

export function AgendaList({
  dates,
  appointments,
  blocks,
  timezone,
  onAppointmentClick,
  onBlockClick,
  onNew,
}: {
  dates: string[];
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  timezone: string;
  onAppointmentClick: (a: AgendaAppointment) => void;
  onBlockClick: (b: AgendaBlock) => void;
  onNew: (date: string) => void;
}) {
  const groups = dates.map((date) => {
    const appts = appointments.filter((a) => zoned(a.startAt, timezone).date === date).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const bl = blocks.filter((b) => zoned(b.startAt, timezone).date <= date && zoned(b.endAt, timezone).date >= date);
    return { date, appts, blocks: bl };
  });
  const empty = groups.every((g) => g.appts.length === 0 && g.blocks.length === 0);
  if (empty)
    return (
      <EmptyState
        icon={CalendarX2}
        title="Nenhum agendamento no período"
        description="Os horários marcados aparecerão aqui."
        action={<Button onClick={() => onNew(dates[0])}>Novo agendamento</Button>}
      />
    );

  return (
    <div className="space-y-5">
      {groups
        .filter((g) => g.appts.length || g.blocks.length)
        .map((g) => {
          const revenue = g.appts.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW').reduce((s, a) => s + Number(a.totalPrice), 0);
          return (
            <section key={g.date}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold capitalize">{fmtDay(fromISODate(g.date))}</h3>
                <span className="text-xs text-muted-foreground">
                  {g.appts.length} agendamento(s) · {money(revenue)}
                </span>
              </div>
              <div className="divide-y overflow-hidden rounded-xl border bg-background">
                {g.blocks.map((b) => {
                  const s = zoned(b.startAt, timezone);
                  const e = zoned(b.endAt, timezone);
                  return (
                    <button key={b.id} onClick={() => onBlockClick(b)} className="flex w-full items-center gap-3 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100">
                      <Lock className="h-4 w-4" />
                      <span className="tabular-nums">
                        {s.date === g.date ? s.time : '00:00'}–{e.date === g.date ? e.time : '23:59'}
                      </span>
                      <span className="truncate">{b.reason || 'Bloqueado'}</span>
                    </button>
                  );
                })}
                {g.appts.map((a) => {
                  const s = zoned(a.startAt, timezone);
                  const e = zoned(a.endAt, timezone);
                  const name = a.client?.name ?? a.guestName ?? 'Sem cliente';
                  return (
                    <button key={a.id} onClick={() => onAppointmentClick(a)} className="flex w-full items-stretch gap-3 px-3 py-2.5 text-left hover:bg-accent/50">
                      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: a.professional.color }} />
                      <div className="w-12 shrink-0 text-sm tabular-nums">
                        <div className="font-semibold">{s.time}</div>
                        <div className="text-xs text-muted-foreground">{e.time}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn('flex items-center gap-1.5 truncate text-sm font-medium', a.status === 'CANCELLED' && 'line-through opacity-70')}>
                          {name}
                          {a.isFitIn && <Zap className="h-3.5 w-3.5 text-amber-600" />}
                          {a.checkedInAt && <Badge variant="success" className="text-[10px]">Chegou</Badge>}
                          {a.recurrenceId && <Repeat className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.services.map((x) => x.service.name).join(', ')} · {a.professional.name}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className={cn('border text-[10px]', STATUS_COLOR[a.status])}>{STATUS_LABEL[a.status]}</Badge>
                        <span className="text-xs font-medium">{money(a.totalPrice)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}

export default AgendaList;
