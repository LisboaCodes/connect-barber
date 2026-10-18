import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Pencil, Play, Repeat, RotateCcw, Star, Trash2, UserX, Zap } from 'lucide-react';
import { Avatar, Badge, Button, Checkbox, ConfirmDialog, Dialog, DialogContent, DialogFooter, Field, Textarea } from '@/components/ui';
import { appointmentsApi, type AgendaAppointment, type AppointmentStatus } from '@/lib/api/appointments';
import { ordersApi } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { fmtDateLong, fmtPhone, fromISODate, minutes, money, SOURCE_LABEL, STATUS_COLOR, STATUS_LABEL, whatsappLink } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { zoned } from './tz';

export function AppointmentDetailDialog({
  appointment,
  timezone,
  onOpenChange,
  onEdit,
}: {
  appointment: AgendaAppointment | null;
  timezone: string;
  onOpenChange: (o: boolean) => void;
  onEdit: (a: AgendaAppointment) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelSeries, setCancelSeries] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['agenda'] });
    qc.invalidateQueries({ queryKey: ['availability'] });
  };

  const status = useMutation({
    mutationFn: (v: { status: AppointmentStatus; reason?: string; cancelSeries?: boolean }) => appointmentsApi.changeStatus(appointment!.id, v.status, v.reason, v.cancelSeries),
    onSuccess: (_d, v) => {
      toast.success(`Status alterado para "${STATUS_LABEL[v.status]}"`);
      refresh();
      setCancelOpen(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openOrder = useMutation({
    mutationFn: () => ordersApi.open({ appointmentId: appointment!.id }),
    onSuccess: (o) => {
      refresh();
      onOpenChange(false);
      navigate(`/app/comandas/${o.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => appointmentsApi.remove(appointment!.id),
    onSuccess: () => {
      toast.success('Agendamento excluído');
      refresh();
      setDeleteOpen(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!appointment) return null;
  const a = appointment;
  const start = zoned(a.startAt, timezone);
  const end = zoned(a.endAt, timezone);
  const name = a.client?.name ?? a.guestName ?? 'Sem cliente';
  const phone = a.client?.phone ?? a.guestPhone;
  const s = a.status;
  const active = s === 'SCHEDULED' || s === 'CONFIRMED' || s === 'IN_PROGRESS';
  const busy = status.isPending;

  const change = (next: AppointmentStatus) => status.mutate({ status: next });
  const wppText = `Olá ${name.split(' ')[0]}! Confirmando seu horário em ${start.date.split('-').reverse().join('/')} às ${start.time} com ${a.professional.name}.`;

  return (
    <>
      <Dialog open={!!appointment} onOpenChange={onOpenChange}>
        <DialogContent size="md" title="Agendamento">
          <div className="space-y-4">
            {/* cabeçalho */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('border', STATUS_COLOR[s])}>{STATUS_LABEL[s]}</Badge>
              {a.isFitIn && (
                <Badge variant="warning" className="gap-1">
                  <Zap className="h-3 w-3" /> Encaixe
                </Badge>
              )}
              {a.recurrenceId && (
                <Badge variant="outline" className="gap-1">
                  <Repeat className="h-3 w-3" /> Recorrente
                </Badge>
              )}
              <Badge variant="outline">{SOURCE_LABEL[a.source] ?? a.source}</Badge>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <CalendarClock className="mt-0.5 h-5 w-5 text-primary" />
              <div className="text-sm">
                <div className="font-semibold capitalize">{fmtDateLong(fromISODate(start.date))}</div>
                <div className="text-muted-foreground">
                  {start.time} – {end.time} · {minutes(a.totalDuration)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.professional.color }} />
                  {a.professional.name}
                </div>
              </div>
            </div>

            {/* cliente */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Avatar src={a.client?.avatarUrl} name={name} size="lg" color="#f59e0b" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">{name}</div>
                <div className="text-muted-foreground">{phone ? fmtPhone(phone) : 'Sem telefone'}</div>
                {a.client && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{a.client.visitsCount} visita(s)</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> {a.client.loyaltyPoints} pts
                    </span>
                    {a.client.noShowCount > 0 && <span className="text-rose-600">{a.client.noShowCount} falta(s)</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {phone && (
                  <Button asChild size="sm" variant="success">
                    <a href={whatsappLink(phone, wppText)} target="_blank" rel="noreferrer">
                      <MessageCircle /> WhatsApp
                    </a>
                  </Button>
                )}
                {a.client && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/app/clientes/${a.client!.id}`)}>
                    Ver ficha
                  </Button>
                )}
              </div>
            </div>

            {/* serviços */}
            <div className="rounded-lg border">
              {a.services.map((sv) => (
                <div key={sv.id} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sv.service.color || '#d1d5db' }} />
                    {sv.service.name}
                    <span className="text-xs text-muted-foreground">{minutes(sv.durationMinutes)}</span>
                  </span>
                  <span>{money(sv.price)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-sm font-semibold">
                <span>Total</span>
                <span>{money(a.totalPrice)}</span>
              </div>
            </div>

            {(a.notes || a.internalNotes || a.cancelReason) && (
              <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                {a.notes && (
                  <p>
                    <span className="font-medium">Obs.:</span> {a.notes}
                  </p>
                )}
                {a.internalNotes && (
                  <p>
                    <span className="font-medium">Interna:</span> {a.internalNotes}
                  </p>
                )}
                {a.cancelReason && (
                  <p className="text-red-700">
                    <span className="font-medium">Motivo do cancelamento:</span> {a.cancelReason}
                  </p>
                )}
              </div>
            )}

            {a.order && (
              <button onClick={() => navigate(`/app/comandas/${a.order!.id}`)} className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm hover:bg-amber-100">
                <span className="flex items-center gap-2 font-medium">
                  <ClipboardList className="h-4 w-4" /> Comanda #{a.order.number}
                </span>
                <span>
                  {STATUS_LABEL[a.order.status]} · {money(a.order.total)}
                </span>
              </button>
            )}

            {/* ações de status */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s === 'SCHEDULED' && (
                <Button variant="outline" onClick={() => change('CONFIRMED')} disabled={busy}>
                  <CheckCircle2 className="text-emerald-600" /> Confirmar
                </Button>
              )}
              {(s === 'SCHEDULED' || s === 'CONFIRMED') && (
                <Button variant="outline" onClick={() => change('IN_PROGRESS')} disabled={busy}>
                  <Play className="text-amber-600" /> Iniciar
                </Button>
              )}
              {active && (
                <Button variant="outline" onClick={() => change('COMPLETED')} disabled={busy}>
                  <CheckCircle2 /> Finalizar
                </Button>
              )}
              {(s === 'SCHEDULED' || s === 'CONFIRMED') && (
                <Button variant="outline" onClick={() => change('NO_SHOW')} disabled={busy}>
                  <UserX className="text-rose-600" /> Não compareceu
                </Button>
              )}
              {active && (
                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setReason(''); setCancelSeries(false); setCancelOpen(true); }} disabled={busy}>
                  <Ban /> Cancelar
                </Button>
              )}
              {(s === 'CANCELLED' || s === 'NO_SHOW' || (s === 'COMPLETED' && a.order?.status !== 'CLOSED')) && (
                <Button variant="outline" onClick={() => change('CONFIRMED')} disabled={busy}>
                  <RotateCcw /> {s === 'CANCELLED' ? 'Reativar' : 'Voltar p/ confirmado'}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="flex-wrap border-t pt-4">
            {!a.order && (
              <Button variant="ghost" className="text-red-600 hover:text-red-700 sm:mr-auto" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Excluir
              </Button>
            )}
            {s !== 'COMPLETED' && s !== 'CANCELLED' && (
              <Button variant="outline" onClick={() => onEdit(a)}>
                <Pencil /> Editar
              </Button>
            )}
            {s !== 'CANCELLED' &&
              (a.order ? (
                <Button onClick={() => navigate(`/app/comandas/${a.order!.id}`)}>
                  <ClipboardList /> Ver comanda
                </Button>
              ) : (
                <Button onClick={() => openOrder.mutate()} loading={openOrder.isPending}>
                  <ClipboardList /> Abrir comanda
                </Button>
              ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* cancelar */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent size="sm" title="Cancelar agendamento" description="O cliente será avisado e a lista de espera do dia notificada.">
          <Field label="Motivo">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ex.: cliente pediu para desmarcar" />
          </Field>
          {a.recurrenceId && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cancelSeries} onCheckedChange={(v) => setCancelSeries(v === true)} /> Cancelar também os próximos da série
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" loading={status.isPending} onClick={() => status.mutate({ status: 'CANCELLED', reason: reason || undefined, cancelSeries: cancelSeries || undefined })}>
              Cancelar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir agendamento?"
        description="O agendamento será removido da agenda. Para manter histórico, prefira cancelar."
        confirmText="Excluir"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

export default AppointmentDetailDialog;
