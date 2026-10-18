import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, CalendarPlus, Clock, MapPin, MessageCircle, RotateCcw, Search, XCircle } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtDateLong, fmtTime, money, STATUS_COLOR, STATUS_LABEL, whatsappLink } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { clientAreaApi, type MyAppointment } from '@/lib/api/clientArea';
import { googleCalendarLink } from '@/lib/api/public';
import { ShopLogo } from '@/components/public/shared';

const ACTIVE = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'];

const addressOf = (t: MyAppointment['tenant']) => [[t.addressStreet, t.addressNumber].filter(Boolean).join(', '), t.addressDistrict, t.addressCity].filter(Boolean).join(' · ');

export default function AppointmentsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'next' | 'past'>('next');
  const [toCancel, setToCancel] = useState<MyAppointment | null>(null);

  const { data = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ['me-appointments'], queryFn: clientAreaApi.appointments });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: MyAppointment[] = [];
    const pa: MyAppointment[] = [];
    for (const a of data) {
      if (ACTIVE.includes(a.status) && new Date(a.endAt).getTime() >= now) up.push(a);
      else pa.push(a);
    }
    up.sort((a, b) => a.startAt.localeCompare(b.startAt));
    pa.sort((a, b) => b.startAt.localeCompare(a.startAt));
    return { upcoming: up, past: pa };
  }, [data]);

  const cancel = useMutation({
    mutationFn: (id: string) => clientAreaApi.cancel(id),
    onSuccess: () => {
      toast.success('Agendamento cancelado');
      setToCancel(null);
      qc.invalidateQueries({ queryKey: ['me-appointments'] });
    },
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível cancelar')),
  });

  const list = tab === 'next' ? upcoming : past;
  const lastShop = data[0]?.tenant;

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );

  if (isError)
    return (
      <EmptyState
        icon={XCircle}
        title="Não foi possível carregar seus agendamentos"
        description={errorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  if (!data.length)
    return (
      <EmptyState
        icon={CalendarDays}
        className="bg-white"
        title="Você ainda não tem agendamentos"
        description="Acesse o site da sua barbearia favorita e agende seu horário em poucos cliques. Seus agendamentos aparecerão aqui."
        action={
          <Button asChild variant="outline">
            <Link to="/">
              <Search /> Conhecer o Connect Barber
            </Link>
          </Button>
        }
      />
    );

  const limitInfo = toCancel ? cancelInfo(toCancel) : null;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus agendamentos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe, cancele ou agende novamente.</p>
        </div>
        {lastShop && (
          <Button asChild>
            <Link to={`/b/${lastShop.slug}/agendar`}>
              <CalendarPlus /> Novo agendamento
            </Link>
          </Button>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1">
        {(
          [
            ['next', `Próximos (${upcoming.length})`],
            ['past', `Histórico (${past.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium', tab === k ? 'bg-white shadow' : 'text-gray-600')}>
            {l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          className="bg-white"
          title={tab === 'next' ? 'Nenhum agendamento futuro' : 'Nenhum agendamento no histórico'}
          description={tab === 'next' ? 'Que tal marcar seu próximo corte?' : undefined}
          action={
            tab === 'next' && lastShop ? (
              <Button asChild>
                <Link to={`/b/${lastShop.slug}/agendar`}>Agendar em {lastShop.name}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <AppointmentCard key={a.id} a={a} upcoming={tab === 'next'} onCancel={() => setToCancel(a)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="Cancelar agendamento?"
        description={
          toCancel ? (
            <span className="block space-y-2">
              <span className="block capitalize">
                {fmtDateLong(toCancel.startAt)} às {fmtTime(toCancel.startAt)} — {toCancel.tenant.name}
              </span>
              {limitInfo && (
                <span className={cn('block rounded-md p-2 text-xs', limitInfo.allowed ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800')}>
                  {limitInfo.allowed
                    ? `Cancelamento online permitido até ${toCancel.tenant.cancelLimitHours}h antes do horário.`
                    : `O prazo para cancelar online (${toCancel.tenant.cancelLimitHours}h antes) já passou. Fale com a barbearia.`}
                </span>
              )}
            </span>
          ) : undefined
        }
        confirmText="Sim, cancelar"
        cancelText="Voltar"
        variant="destructive"
        loading={cancel.isPending}
        onConfirm={() => {
          if (toCancel) cancel.mutate(toCancel.id);
        }}
      />
    </div>
  );
}

function cancelInfo(a: MyAppointment) {
  const limit = new Date(a.startAt).getTime() - (a.tenant.cancelLimitHours ?? 0) * 3600_000;
  return { allowed: Date.now() <= limit };
}

function AppointmentCard({ a, upcoming, onCancel }: { a: MyAppointment; upcoming: boolean; onCancel: () => void }) {
  const svc = a.services.map((s) => s.name).filter(Boolean).join(', ');
  const wa = a.tenant.whatsapp || a.tenant.phone;
  const address = addressOf(a.tenant);
  const canCancel = upcoming && ['SCHEDULED', 'CONFIRMED'].includes(a.status);
  const withinLimit = cancelInfo(a).allowed;
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex gap-4 p-4">
        <div className={cn('flex w-16 shrink-0 flex-col items-center justify-center rounded-lg py-2', upcoming ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700')}>
          <span className="text-[11px] uppercase">{new Date(a.startAt).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
          <span className="text-2xl font-bold leading-none">{new Date(a.startAt).getDate()}</span>
          <span className="mt-0.5 text-xs font-medium">{fmtTime(a.startAt)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShopLogo name={a.tenant.name} logoUrl={a.tenant.logoUrl} className="h-6 w-6 rounded-md text-[9px]" />
            <Link to={`/b/${a.tenant.slug}`} className="truncate font-semibold hover:underline">
              {a.tenant.name}
            </Link>
            <Badge className={cn('border', STATUS_COLOR[a.status])}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
          </div>
          <div className="mt-1 text-sm">{svc || 'Serviço'}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="capitalize">{fmtDateLong(a.startAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtTime(a.startAt)} – {fmtTime(a.endAt)}
            </span>
            {a.professional && <span>com {a.professional.name}</span>}
            <span className="font-medium text-gray-900">{money(a.totalPrice)}</span>
          </div>
          {upcoming && address && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {address}
            </div>
          )}
          {a.status === 'CANCELLED' && a.cancelReason && <div className="mt-1 text-xs text-red-700">Motivo: {a.cancelReason}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t bg-gray-50/60 px-4 py-2">
        {upcoming ? (
          <>
            <Button asChild size="sm" variant="ghost">
              <a href={googleCalendarLink({ title: `${svc} - ${a.tenant.name}`, start: a.startAt, end: a.endAt, location: address })} target="_blank" rel="noreferrer">
                <CalendarPlus /> Calendário
              </a>
            </Button>
            {wa && (
              <Button asChild size="sm" variant="ghost">
                <a href={whatsappLink(wa, `Olá! Sobre meu agendamento de ${fmtDateLong(a.startAt)} às ${fmtTime(a.startAt)}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onCancel} title={withinLimit ? undefined : 'Prazo de cancelamento online encerrado'}>
                <XCircle /> Cancelar
              </Button>
            )}
          </>
        ) : (
          <Button asChild size="sm" variant="ghost" className="text-amber-800">
            <Link to={`/b/${a.tenant.slug}`}>
              <RotateCcw /> Agendar de novo
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
