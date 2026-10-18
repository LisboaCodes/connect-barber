import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CalendarPlus, Clock, ListTodo, MessageCircle, MoreVertical, Plus, Scissors, User } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { waitlistApi, type WaitlistEntry, type WaitlistStatus } from '@/lib/api/waitlist';
import { catalogApi } from '@/lib/api/appointments';
import { errorMessage } from '@/lib/api/client';
import { fmtDateTime, fmtDay, fmtPhone, fromISODate, STATUS_COLOR, STATUS_LABEL, toISODate, whatsappLink } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ClientSearch, clientPayload, type ClientPick } from '@/components/agenda/ClientSearch';

type Scope = 'day' | 'upcoming';

export default function WaitlistPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [date, setDate] = useState(toISODate(new Date()));
  const [status, setStatus] = useState<string>('ACTIVE');
  const [addOpen, setAddOpen] = useState(false);

  const q = useQuery({
    queryKey: ['waitlist', scope, date, status],
    queryFn: () => waitlistApi.list({ ...(scope === 'day' ? { date } : { from: toISODate(new Date()) }), status: status && status !== 'ACTIVE' ? status : undefined }),
  });
  const entries = (q.data ?? []).filter((e) => status !== 'ACTIVE' || e.status === 'WAITING' || e.status === 'NOTIFIED');

  const notify = useMutation({
    mutationFn: (id: string) => waitlistApi.notify(id),
    onSuccess: () => {
      toast.success('Cliente avisado');
      qc.invalidateQueries({ queryKey: ['waitlist'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setEntryStatus = useMutation({
    mutationFn: (v: { id: string; status: WaitlistStatus }) => waitlistApi.setStatus(v.id, v.status),
    onSuccess: (_d, v) => {
      toast.success(`Marcado como "${STATUS_LABEL[v.status]}"`);
      qc.invalidateQueries({ queryKey: ['waitlist'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const schedule = (e: WaitlistEntry) => {
    const p = new URLSearchParams({ date: e.date.slice(0, 10), clientId: e.clientId, view: 'day' });
    if (e.professionalId) p.set('professionalId', e.professionalId);
    navigate(`/app/agenda?${p.toString()}`);
  };

  // agrupa por data
  const groups = entries.reduce<Record<string, WaitlistEntry[]>>((acc, e) => {
    const d = e.date.slice(0, 10);
    (acc[d] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Lista de espera"
        description="Clientes aguardando um horário vago. Quando houver cancelamento, eles são avisados automaticamente."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> Adicionar à lista
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            <TabsTrigger value="upcoming">Próximos dias</TabsTrigger>
            <TabsTrigger value="day">Por data</TabsTrigger>
          </TabsList>
        </Tabs>
        {scope === 'day' && <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48 sm:ml-auto">
          <option value="ACTIVE">Aguardando / avisados</option>
          <option value="">Todos os status</option>
          <option value="WAITING">Aguardando</option>
          <option value="NOTIFIED">Avisados</option>
          <option value="BOOKED">Agendaram</option>
          <option value="CANCELLED">Cancelados</option>
        </Select>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : q.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(q.error)}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Ninguém na lista de espera"
          description="Adicione clientes que querem um horário em um dia lotado."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Adicionar à lista
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, list]) => (
              <section key={d}>
                <h3 className="mb-2 text-sm font-semibold capitalize">
                  {fmtDay(fromISODate(d))} <span className="font-normal text-muted-foreground">· {list.length} cliente(s)</span>
                </h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((e) => {
                    const active = e.status === 'WAITING' || e.status === 'NOTIFIED';
                    return (
                      <Card key={e.id} className={cn('flex flex-col gap-3 p-4', !active && 'opacity-70')}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">{e.client.name}</div>
                            <div className="text-sm text-muted-foreground">{fmtPhone(e.client.phone)}</div>
                          </div>
                          <Badge className={cn('border', STATUS_COLOR[e.status])}>{STATUS_LABEL[e.status]}</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {e.status !== 'WAITING' && <DropdownMenuItem onClick={() => setEntryStatus.mutate({ id: e.id, status: 'WAITING' })}>Voltar para aguardando</DropdownMenuItem>}
                              {e.status !== 'BOOKED' && <DropdownMenuItem onClick={() => setEntryStatus.mutate({ id: e.id, status: 'BOOKED' })}>Marcar como agendado</DropdownMenuItem>}
                              {e.status !== 'CANCELLED' && (
                                <DropdownMenuItem destructive onClick={() => setEntryStatus.mutate({ id: e.id, status: 'CANCELLED' })}>
                                  Remover da lista
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" /> {e.professional?.name ?? 'Qualquer profissional'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Scissors className="h-3.5 w-3.5" /> {e.service?.name ?? 'Qualquer serviço'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> {e.periodStart || e.periodEnd ? `${e.periodStart ?? '...'} às ${e.periodEnd ?? '...'}` : 'Qualquer horário'}
                          </div>
                          {e.notifiedAt && <div className="text-amber-700">Avisado em {fmtDateTime(e.notifiedAt)}</div>}
                          {e.notes && <div className="italic">"{e.notes}"</div>}
                        </div>
                        {active && (
                          <div className="mt-auto flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => schedule(e)}>
                              <CalendarPlus /> Agendar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => notify.mutate(e.id)} disabled={notify.isPending && notify.variables === e.id}>
                              <Bell /> Avisar
                            </Button>
                            {e.client.phone && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={whatsappLink(e.client.phone, `Olá ${e.client.name.split(' ')[0]}! Vagou um horário para ${d.split('-').reverse().slice(0, 2).join('/')}. Quer agendar?`)} target="_blank" rel="noreferrer">
                                  <MessageCircle className="text-emerald-600" /> WhatsApp
                                </a>
                              </Button>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}

      <AddWaitlistDialog open={addOpen} onOpenChange={setAddOpen} defaultDate={scope === 'day' ? date : toISODate(new Date())} />
    </div>
  );
}

function AddWaitlistDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDate: string }) {
  const qc = useQueryClient();
  const [client, setClient] = useState<ClientPick | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setClient(null);
    setDate(defaultDate);
    setProfessionalId('');
    setServiceId('');
    setPeriodStart('');
    setPeriodEnd('');
    setNotes('');
  }, [open, defaultDate]);

  const prosQ = useQuery({ queryKey: ['professionals'], queryFn: catalogApi.professionals, enabled: open, staleTime: 120_000 });
  const servicesQ = useQuery({ queryKey: ['services'], queryFn: catalogApi.services, enabled: open, staleTime: 120_000 });

  const save = useMutation({
    mutationFn: () =>
      waitlistApi.add({
        ...clientPayload(client),
        date,
        professionalId: professionalId || undefined,
        serviceId: serviceId || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Cliente adicionado à lista de espera');
      qc.invalidateQueries({ queryKey: ['waitlist'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Adicionar à lista de espera">
        <div className="space-y-4">
          <Field label="Cliente" required>
            <ClientSearch value={client} onChange={setClient} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data desejada" required>
              <Input type="date" value={date} min={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Profissional">
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Qualquer um</option>
                {(prosQ.data ?? [])
                  .filter((p) => p.isActive !== false)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Serviço" className="sm:col-span-2">
              <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Qualquer serviço</option>
                {(servicesQ.data ?? [])
                  .filter((s) => s.isActive !== false)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="A partir de">
              <Input type="time" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="time" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Observações">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!client || !date || (!!periodStart && !!periodEnd && periodStart >= periodEnd)} loading={save.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
