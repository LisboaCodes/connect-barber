import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus, RefreshCw } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, Input, PageHeader, Select, Skeleton, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { appointmentsApi, catalogApi, type AgendaAppointment, type AgendaBlock } from '@/lib/api/appointments';
import { errorMessage } from '@/lib/api/client';
import { fmtDateLong, fromISODate, money, STATUS_COLOR, STATUS_LABEL, toISODate } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils/cn';
import { TimeGrid, type GridColumn } from '@/components/agenda/TimeGrid';
import { AgendaList } from '@/components/agenda/AgendaList';
import { AppointmentFormDialog, type AppointmentFormInitial } from '@/components/agenda/AppointmentFormDialog';
import { AppointmentDetailDialog } from '@/components/agenda/AppointmentDetailDialog';
import { BlockDialog } from '@/components/agenda/BlockDialog';
import { openingRanges, toMin, workingFor, zoned, type Interval } from '@/components/agenda/tz';

type View = 'day' | 'week' | 'list';
const LEGEND = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const;

export default function AgendaPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const role = useAuthStore((s) => s.current?.role);
  const ownProId = useAuthStore((s) => s.current?.professionalId ?? null);
  const isPro = role === 'PROFESSIONAL';

  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : toISODate(new Date());
  const professionalId = isPro ? ownProId ?? '' : params.get('professionalId') ?? '';
  const [view, setView] = useState<View>(() => {
    const v = params.get('view');
    if (v === 'day' || v === 'week' || v === 'list') return v;
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'day';
  });
  const [showCancelled, setShowCancelled] = useState(false);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // período
  const weekStart = startOfWeek(fromISODate(date), { weekStartsOn: 1 });
  const dates = view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const from = dates[0];
  const to = dates[dates.length - 1];

  const agendaQ = useQuery({
    queryKey: ['agenda', from, to, professionalId || 'all'],
    queryFn: () => appointmentsApi.agenda(from, to, professionalId || undefined),
    refetchInterval: 60_000,
  });
  const data = agendaQ.data;
  const tz = data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const interval = data?.slotIntervalMin || 15;
  const allPros = data?.professionals ?? [];

  // para selects (lista completa mesmo quando filtrado)
  const prosQ = useQuery({ queryKey: ['professionals'], queryFn: catalogApi.professionals, staleTime: 120_000, enabled: !isPro });
  const proOptions = useMemo(() => {
    if (isPro) return allPros.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const list = (prosQ.data ?? []).filter((p) => p.isActive !== false);
    return list.length ? list.map((p) => ({ id: p.id, name: p.name, color: p.color })) : allPros.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  }, [isPro, allPros, prosQ.data]);

  const weekPro = view === 'week' ? allPros.find((p) => p.id === professionalId) ?? allPros[0] : undefined;
  const appointments = useMemo(() => (data?.appointments ?? []).filter((a) => showCancelled || a.status !== 'CANCELLED'), [data?.appointments, showCancelled]);
  const blocks = data?.blocks ?? [];
  const today = zoned(new Date(), tz).date;

  // colunas
  const columns: GridColumn[] = useMemo(() => {
    if (!data) return [];
    if (view === 'day') {
      return allPros.map((p) => {
        const w = workingFor(p, date, data.openingHours);
        return {
          key: p.id,
          date,
          professionalId: p.id,
          working: w.working,
          off: w.off,
          isToday: date === today,
          header: (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar src={p.avatarUrl} name={p.name} size="sm" color={p.color} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{w.off ? 'Folga' : w.working.map((x) => `${String(Math.floor(x.start / 60)).padStart(2, '0')}h–${String(Math.floor(x.end / 60)).padStart(2, '0')}h`).join(' / ')}</div>
              </div>
            </div>
          ),
        };
      });
    }
    if (view === 'week' && weekPro) {
      return dates.map((d) => {
        const w = workingFor(weekPro, d, data.openingHours);
        const dt = fromISODate(d);
        return {
          key: d,
          date: d,
          professionalId: weekPro.id,
          working: w.working,
          off: w.off,
          isToday: d === today,
          header: (
            <button className="text-center" onClick={() => { setView('day'); setParam({ date: d }); }}>
              <div className="text-[11px] uppercase text-muted-foreground">{format(dt, 'EEE', { locale: ptBR })}</div>
              <div className={cn('text-base font-bold', d === today && 'text-primary')}>{format(dt, 'dd/MM')}</div>
            </button>
          ),
        };
      });
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, date, weekPro?.id, today, from]);

  // faixa de horário exibida
  const range: Interval = useMemo(() => {
    let start = Infinity;
    let end = -Infinity;
    for (const d of dates) {
      const open = openingRanges(data?.openingHours ?? null, fromISODate(d).getDay());
      open?.forEach((r) => {
        start = Math.min(start, r.start);
        end = Math.max(end, r.end);
      });
    }
    columns.forEach((c) =>
      c.working.forEach((w) => {
        start = Math.min(start, w.start);
        end = Math.max(end, w.end);
      }),
    );
    for (const a of appointments) {
      const s = zoned(a.startAt, tz);
      const e = zoned(a.endAt, tz);
      if (!dates.includes(s.date)) continue;
      start = Math.min(start, s.minutes);
      end = Math.max(end, e.date === s.date ? e.minutes : 24 * 60);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { start: toMin('08:00'), end: toMin('20:00') };
    return { start: Math.floor(start / 60) * 60, end: Math.min(24 * 60, Math.ceil(end / 60) * 60) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, appointments, data?.openingHours, tz, from, to]);

  // diálogos
  const [form, setForm] = useState<{ open: boolean; initial: AppointmentFormInitial; appointment: AgendaAppointment | null }>({ open: false, initial: { date }, appointment: null });
  const [detail, setDetail] = useState<AgendaAppointment | null>(null);
  const [blockForm, setBlockForm] = useState<{ open: boolean; date: string; start?: string; professionalId?: string }>({ open: false, date });
  const [blockToRemove, setBlockToRemove] = useState<AgendaBlock | null>(null);

  // mantém o detalhe atualizado após refetch
  useEffect(() => {
    if (!detail || !data) return;
    const fresh = data.appointments.find((a) => a.id === detail.id);
    if (fresh && fresh !== detail) setDetail(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ?clientId= abre novo agendamento já com o cliente
  const clientIdParam = params.get('clientId');
  useEffect(() => {
    if (!clientIdParam) return;
    let alive = true;
    catalogApi
      .getClient(clientIdParam)
      .then((c) => {
        if (!alive) return;
        setForm({ open: true, appointment: null, initial: { date, professionalId: professionalId || undefined, client: { id: c.id, name: c.name, phone: c.phone } } });
      })
      .catch(() => toast.error('Cliente não encontrado'))
      .finally(() => setParam({ clientId: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIdParam]);

  const removeBlock = useMutation({
    mutationFn: (id: string) => appointmentsApi.removeBlock(id),
    onSuccess: () => {
      toast.success('Bloqueio removido');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      setBlockToRemove(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const step = view === 'day' ? 1 : 7;
  const go = (n: number) => setParam({ date: toISODate(addDays(fromISODate(date), n * step)) });

  const openNew = (d = date, time?: string, proId?: string) =>
    setForm({ open: true, appointment: null, initial: { date: d, time, professionalId: proId || professionalId || weekPro?.id || undefined } });

  // indicadores
  const visible = (data?.appointments ?? []).filter((a) => dates.includes(zoned(a.startAt, tz).date) && (view !== 'week' || a.professionalId === weekPro?.id));
  const activeCount = visible.filter((a) => !['CANCELLED', 'NO_SHOW'].includes(a.status)).length;
  const confirmed = visible.filter((a) => a.status === 'CONFIRMED').length;
  const revenue = visible.filter((a) => !['CANCELLED', 'NO_SHOW'].includes(a.status)).reduce((s, a) => s + Number(a.totalPrice), 0);

  const title =
    view === 'day'
      ? fmtDateLong(fromISODate(date))
      : `${format(fromISODate(from), "dd 'de' MMM", { locale: ptBR })} – ${format(fromISODate(to), "dd 'de' MMM yyyy", { locale: ptBR })}`;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={<span className="capitalize">{title}</span>}
        actions={
          <>
            <Button variant="outline" onClick={() => setBlockForm({ open: true, date, professionalId: professionalId || undefined })}>
              <Lock /> Bloquear horário
            </Button>
            <Button onClick={() => openNew()}>
              <Plus /> Novo agendamento
            </Button>
          </>
        }
      />

      {/* barra de controles */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-background p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setParam({ date: toISODate(new Date()) })}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => go(-1)} title="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => go(1)} title="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => e.target.value && setParam({ date: e.target.value })} className="w-40" />
          <Button variant="ghost" size="icon" onClick={() => agendaQ.refetch()} title="Atualizar">
            <RefreshCw className={cn('h-4 w-4', agendaQ.isFetching && 'animate-spin')} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {!isPro && (
            <Select value={professionalId} onChange={(e) => setParam({ professionalId: e.target.value || null })} className="w-48">
              <option value="">{view === 'week' ? 'Profissional...' : 'Todos os profissionais'}</option>
              {proOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showCancelled} onCheckedChange={setShowCancelled} /> Cancelados
          </label>
          <Tabs
            value={view}
            onValueChange={(v) => {
              setView(v as View);
              setParam({ view: v });
            }}
          >
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="list">Lista</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* resumo + legenda */}
      <div className="mb-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>
            <b className="text-foreground">{activeCount}</b> agendamento(s)
          </span>
          <span>
            <b className="text-foreground">{confirmed}</b> confirmado(s)
          </span>
          <span>
            Previsto: <b className="text-foreground">{money(revenue)}</b>
          </span>
          {view === 'week' && weekPro && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: weekPro.color }} /> {weekPro.name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEGEND.map((s) => (
            <span key={s} className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_COLOR[s])}>
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.2) 0 4px, transparent 4px 8px)' }}>
            Bloqueio
          </span>
          <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Fora da jornada</span>
        </div>
      </div>

      {agendaQ.isLoading ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : agendaQ.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage(agendaQ.error)}{' '}
          <Button variant="link" onClick={() => agendaQ.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : view === 'list' ? (
        <AgendaList dates={dates} appointments={appointments} blocks={blocks} timezone={tz} onAppointmentClick={setDetail} onBlockClick={setBlockToRemove} onNew={(d) => openNew(d)} />
      ) : columns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <CalendarDays className="mb-2 h-8 w-8 text-primary" />
          Nenhum profissional ativo para exibir. Cadastre profissionais e suas jornadas de trabalho.
        </div>
      ) : (
        <TimeGrid
          columns={columns}
          appointments={appointments}
          blocks={blocks}
          timezone={tz}
          interval={interval}
          range={range}
          onSlotClick={(d, time, proId) => openNew(d, time, proId)}
          onAppointmentClick={setDetail}
          onBlockClick={setBlockToRemove}
        />
      )}

      <AppointmentFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        professionals={proOptions}
        initial={form.initial}
        appointment={form.appointment}
        timezone={tz}
        lockProfessional={isPro}
      />

      <AppointmentDetailDialog
        appointment={detail}
        timezone={tz}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={(a) => {
          setDetail(null);
          setForm({ open: true, appointment: a, initial: { date } });
        }}
      />

      <BlockDialog
        open={blockForm.open}
        onOpenChange={(o) => setBlockForm((b) => ({ ...b, open: o }))}
        professionals={proOptions}
        initial={{ date: blockForm.date, start: blockForm.start, professionalId: blockForm.professionalId }}
        timezone={tz}
        ownProfessionalId={isPro ? ownProId : undefined}
      />

      <ConfirmDialog
        open={!!blockToRemove}
        onOpenChange={(o) => !o && setBlockToRemove(null)}
        title="Remover bloqueio?"
        description={
          blockToRemove
            ? `${blockToRemove.reason || 'Bloqueio'} · ${zoned(blockToRemove.startAt, tz).date.split('-').reverse().join('/')} ${zoned(blockToRemove.startAt, tz).time} – ${zoned(blockToRemove.endAt, tz).time}${blockToRemove.professionalId ? ` · ${allPros.find((p) => p.id === blockToRemove.professionalId)?.name ?? ''}` : ' · toda a barbearia'}`
            : undefined
        }
        confirmText="Remover bloqueio"
        variant="destructive"
        loading={removeBlock.isPending}
        onConfirm={() => { if (blockToRemove) removeBlock.mutate(blockToRemove.id); }}
      />
    </div>
  );
}
