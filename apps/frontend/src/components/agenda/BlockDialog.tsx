import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Switch } from '@/components/ui';
import { appointmentsApi } from '@/lib/api/appointments';
import { errorMessage } from '@/lib/api/client';
import type { ProLite } from './AppointmentFormDialog';
import { zonedToISO } from './tz';

export function BlockDialog({
  open,
  onOpenChange,
  professionals,
  initial,
  timezone,
  ownProfessionalId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professionals: ProLite[];
  initial: { date: string; start?: string; professionalId?: string };
  timezone: string;
  /** Papel PROFESSIONAL: só pode bloquear a própria agenda */
  ownProfessionalId?: string | null;
}) {
  const qc = useQueryClient();
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setProfessionalId(ownProfessionalId ?? initial.professionalId ?? '');
    setDate(initial.date);
    setEndDate(initial.date);
    const s = initial.start ?? '12:00';
    setStart(s);
    const [h, m] = s.split(':').map(Number);
    setEnd(`${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setAllDay(false);
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () => {
      const startAt = zonedToISO(date, allDay ? '00:00' : start, timezone);
      const endAt = zonedToISO(allDay ? endDate || date : date, allDay ? '23:59' : end, timezone);
      return appointmentsApi.createBlock({ professionalId: professionalId || undefined, startAt, endAt, reason: reason || undefined });
    },
    onSuccess: () => {
      toast.success('Horário bloqueado');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const valid = !!date && (allDay ? (endDate || date) >= date : start < end);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Bloquear horário" description="Impede agendamentos no período (almoço, compromisso, folga...).">
        <div className="space-y-4">
          <Field label="Profissional">
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={!!ownProfessionalId}>
              {!ownProfessionalId && <option value="">Toda a barbearia</option>}
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span className="font-medium">Dia inteiro</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </label>
          {allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Até">
                <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" className="col-span-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Início">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Fim">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Motivo">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: almoço" maxLength={200} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid} loading={save.isPending}>
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BlockDialog;
