import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock, Repeat, Search, Zap } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Spinner, Switch, Textarea } from '@/components/ui';
import { appointmentsApi, catalogApi, servicePriceFor, type AgendaAppointment, type RecurrenceFrequency } from '@/lib/api/appointments';
import { errorMessage } from '@/lib/api/client';
import { minutes, money } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ClientSearch, clientPayload, type ClientPick } from './ClientSearch';
import { zoned } from './tz';

export interface ProLite {
  id: string;
  name: string;
  color: string;
}

export interface AppointmentFormInitial {
  date: string;
  time?: string;
  professionalId?: string;
  client?: ClientPick | null;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  professionals,
  initial,
  appointment,
  timezone,
  lockProfessional,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professionals: ProLite[];
  initial: AppointmentFormInitial;
  appointment?: AgendaAppointment | null;
  timezone: string;
  lockProfessional?: boolean;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!appointment;

  const [client, setClient] = useState<ClientPick | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [fitIn, setFitIn] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('WEEKLY');
  const [occurrences, setOccurrences] = useState(4);
  const [serviceFilter, setServiceFilter] = useState('');
  const [applyToSeries, setApplyToSeries] = useState(false);

  // carrega valores ao abrir
  useEffect(() => {
    if (!open) return;
    if (appointment) {
      const z = zoned(appointment.startAt, timezone);
      setClient(
        appointment.client
          ? { id: appointment.client.id, name: appointment.client.name, phone: appointment.client.phone }
          : appointment.guestName
            ? { name: appointment.guestName, phone: appointment.guestPhone, isNew: true }
            : null,
      );
      setServiceIds(appointment.services.map((s) => s.serviceId));
      setProfessionalId(appointment.professionalId);
      setDate(z.date);
      setTime(z.time);
      setNotes(appointment.notes ?? '');
      setInternalNotes(appointment.internalNotes ?? '');
      setFitIn(appointment.isFitIn);
    } else {
      setClient(initial.client ?? null);
      setServiceIds([]);
      setProfessionalId(initial.professionalId || professionals[0]?.id || '');
      setDate(initial.date);
      setTime(initial.time ?? '');
      setNotes('');
      setInternalNotes('');
      setFitIn(false);
    }
    setRecurring(false);
    setFrequency('WEEKLY');
    setOccurrences(4);
    setServiceFilter('');
    setApplyToSeries(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: catalogApi.services, enabled: open, staleTime: 120_000 });
  const services = useMemo(() => (servicesQ.data ?? []).filter((s) => s.isActive !== false), [servicesQ.data]);
  const selected = serviceIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as typeof services;
  const totals = selected.reduce(
    (acc, s) => {
      const v = servicePriceFor(s, professionalId);
      return { price: acc.price + v.price, duration: acc.duration + v.durationMinutes };
    },
    { price: 0, duration: 0 },
  );

  const availQ = useQuery({
    queryKey: ['availability', date, professionalId, serviceIds.join(','), appointment?.id],
    queryFn: () => appointmentsApi.availability({ date, professionalId, serviceIds: serviceIds.join(',') || undefined, ignoreAppointmentId: appointment?.id }),
    enabled: open && !!date && !!professionalId,
  });
  const avail = availQ.data?.find((a) => a.professionalId === professionalId);
  const timeIsFree = !time || !avail || avail.slots.includes(time);

  const filtered = services.filter((s) => !serviceFilter || s.name.toLowerCase().includes(serviceFilter.toLowerCase()));

  const save = useMutation({
    mutationFn: async () => {
      if (editing && appointment) {
        let clientId: string | null | undefined;
        if (client?.id) clientId = client.id !== appointment.clientId ? client.id : undefined;
        else if (client) {
          const sameGuest = !appointment.clientId && appointment.guestName === client.name;
          if (!sameGuest) {
            const c = await catalogApi.createClient({ name: client.name, phone: client.phone ?? undefined });
            clientId = c.id;
          }
        } else if (appointment.clientId) clientId = null;
        return appointmentsApi.update(appointment.id, {
          professionalId,
          clientId,
          serviceIds,
          date,
          time,
          fitIn,
          notes,
          internalNotes,
          applyToSeries: appointment.recurrenceId ? applyToSeries : undefined,
        });
      }
      return appointmentsApi.create({
        professionalId,
        ...clientPayload(client),
        serviceIds,
        date,
        time,
        fitIn: fitIn || undefined,
        notes: notes || undefined,
        internalNotes: internalNotes || undefined,
        recurrence: recurring ? { frequency, occurrences } : undefined,
      });
    },
    onSuccess: (res: any) => {
      if (editing) toast.success('Agendamento atualizado');
      else {
        const created = res?.created ?? 1;
        toast.success(created > 1 ? `${created} agendamentos criados` : 'Agendamento criado');
        if (res?.skipped?.length) toast.warning(`${res.skipped.length} ocorrência(s) não agendada(s)`, { description: res.skipped.slice(0, 4).join('\n') });
      }
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['waitlist'] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSave = !!professionalId && serviceIds.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={editing ? 'Editar agendamento' : 'Novo agendamento'} description={editing ? undefined : 'Preencha os dados do atendimento'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <Field label="Cliente" hint={!client ? 'Opcional — deixe vazio para horário sem cliente identificado' : undefined}>
            <ClientSearch value={client} onChange={setClient} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Profissional" required>
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={lockProfessional}>
                {!professionalId && <option value="">Selecione</option>}
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hora" required>
              <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>

          {/* sugestões de horários */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horários livres {serviceIds.length ? `para ${minutes(totals.duration)}` : ''}
              {availQ.isFetching && <Spinner className="h-3.5 w-3.5" />}
            </div>
            {avail?.off ? (
              <p className="text-sm text-muted-foreground">Profissional de folga neste dia. Use "Encaixe" para agendar mesmo assim.</p>
            ) : avail && avail.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem horários livres nesta data.</p>
            ) : (
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {(avail?.slots ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    className={cn('rounded-md border px-2 py-1 text-xs font-medium transition-colors', time === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary hover:text-primary')}
                  >
                    {s}
                  </button>
                ))}
                {!avail && !availQ.isFetching && <span className="text-xs text-muted-foreground">Escolha profissional e data</span>}
              </div>
            )}
            {time && avail && !timeIsFree && !fitIn && <p className="mt-2 text-xs text-amber-700">O horário {time} não está livre. Ative "Encaixe" para forçar.</p>}
          </div>

          <Field label="Serviços" required>
            <div className="rounded-md border">
              <div className="border-b p-2">
                <Input prefix={<Search className="h-4 w-4" />} placeholder="Filtrar serviços" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="h-8" />
              </div>
              <div className="max-h-48 divide-y overflow-y-auto">
                {servicesQ.isLoading && <div className="p-3 text-sm text-muted-foreground">Carregando serviços...</div>}
                {!servicesQ.isLoading && filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum serviço</div>}
                {filtered.map((s) => {
                  const on = serviceIds.includes(s.id);
                  const v = servicePriceFor(s, professionalId);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                      className={cn('flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent', on && 'bg-amber-50')}
                    >
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>{on && <Check className="h-3 w-3" />}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color || '#d1d5db' }} />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{minutes(v.durationMinutes)}</span>
                      <span className="w-20 text-right text-xs font-medium">{money(v.price)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{serviceIds.length} selecionado(s)</span>
                <span className="font-semibold">
                  {minutes(totals.duration)} · {money(totals.price)}
                </span>
              </div>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Observações (visível ao cliente)">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
            <Field label="Nota interna">
              <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} maxLength={1000} />
            </Field>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-600" />
                <span>
                  <span className="font-medium">Encaixe</span>
                  <span className="block text-xs text-muted-foreground">Ignora jornada e conflitos de horário</span>
                </span>
              </span>
              <Switch checked={fitIn} onCheckedChange={setFitIn} />
            </label>
            {!editing && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <Repeat className="h-4 w-4 text-amber-600" />
                    <span>
                      <span className="font-medium">Repetir (cliente fixo)</span>
                      <span className="block text-xs text-muted-foreground">Cria a série de agendamentos recorrentes</span>
                    </span>
                  </span>
                  <Switch checked={recurring} onCheckedChange={setRecurring} />
                </label>
                {recurring && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Frequência">
                      <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                        <option value="WEEKLY">Semanal</option>
                        <option value="BIWEEKLY">Quinzenal</option>
                        <option value="MONTHLY">Mensal</option>
                      </Select>
                    </Field>
                    <Field label="Nº de ocorrências" hint="Entre 2 e 52, incluindo esta">
                      <Input type="number" min={2} max={52} value={occurrences} onChange={(e) => setOccurrences(Math.max(2, Math.min(52, Number(e.target.value) || 2)))} />
                    </Field>
                  </div>
                )}
              </>
            )}
            {editing && appointment?.recurrenceId && (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Aplicar também aos próximos da série</span>
                <Switch checked={applyToSeries} onCheckedChange={setApplyToSeries} />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSave} loading={save.isPending}>
              {editing ? 'Salvar alterações' : 'Agendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AppointmentFormDialog;
