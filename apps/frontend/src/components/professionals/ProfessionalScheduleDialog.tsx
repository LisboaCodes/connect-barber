import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, CalendarPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Dialog, DialogContent, DialogFooter, Field, Input, Select, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { professionalsApi, type Professional } from '@/lib/api/professionals';
import { fmtDateLong, fromISODate, toISODate } from '@/lib/utils/format';
import { WeekScheduleEditor, validateWeek, weekFromSchedules, weekToSchedules, type WeekRanges } from './WeekScheduleEditor';

const overrideSchema = z
  .object({
    date: z.string().min(10, 'Informe a data'),
    type: z.enum(['OFF', 'EXTRA']),
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'EXTRA') {
      if (!v.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Obrigatório' });
      if (!v.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Obrigatório' });
      if (v.startTime && v.endTime && v.startTime >= v.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Deve ser após o início' });
    }
  });
type OverrideForm = z.infer<typeof overrideSchema>;

export function ProfessionalScheduleDialog({ open, onOpenChange, professional }: { open: boolean; onOpenChange: (o: boolean) => void; professional: Professional | null }) {
  const qc = useQueryClient();
  const [week, setWeek] = useState<WeekRanges>(() => weekFromSchedules(professional?.workSchedules));
  const id = professional?.id ?? '';

  useEffect(() => {
    if (open && professional) setWeek(weekFromSchedules(professional.workSchedules));
  }, [open, professional]);

  const save = useMutation({
    mutationFn: () => professionalsApi.setSchedule(id, weekToSchedules(week)),
    onSuccess: () => {
      toast.success('Jornada salva');
      qc.invalidateQueries({ queryKey: ['professionals'] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const today = toISODate();
  const { data: overrides, isLoading } = useQuery({ queryKey: ['professionals', id, 'overrides'], queryFn: () => professionalsApi.overrides(id, today), enabled: open && !!id });

  const form = useForm<OverrideForm>({ resolver: zodResolver(overrideSchema), defaultValues: { date: today, type: 'OFF', startTime: '09:00', endTime: '18:00', reason: '' } });
  const type = form.watch('type');

  const addOverride = useMutation({
    mutationFn: (v: OverrideForm) =>
      professionalsApi.createOverride(id, { date: v.date, type: v.type, startTime: v.type === 'EXTRA' ? v.startTime : undefined, endTime: v.type === 'EXTRA' ? v.endTime : undefined, reason: v.reason || undefined }),
    onSuccess: () => {
      toast.success('Registro adicionado');
      form.reset({ ...form.getValues(), reason: '' });
      qc.invalidateQueries({ queryKey: ['professionals', id, 'overrides'] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const removeOverride = useMutation({
    mutationFn: (oid: string) => professionalsApi.removeOverride(id, oid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professionals', id, 'overrides'] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const weekError = validateWeek(week);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title={`Jornada de ${professional?.name ?? ''}`} description="Defina os horários de atendimento semanais e as exceções por data.">
        <Tabs defaultValue="week">
          <TabsList>
            <TabsTrigger value="week">Jornada semanal</TabsTrigger>
            <TabsTrigger value="overrides">Folgas e jornadas específicas</TabsTrigger>
          </TabsList>
          <TabsContent value="week" className="space-y-4">
            <p className="text-sm text-muted-foreground">Adicione mais de um intervalo no dia para registrar pausas (ex.: almoço das 12h às 13h).</p>
            <WeekScheduleEditor value={week} onChange={setWeek} closedLabel="Folga" />
            {weekError && <p className="text-sm text-red-600">{weekError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button loading={save.isPending} disabled={!!weekError} onClick={() => save.mutate()}>
                Salvar jornada
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="overrides" className="space-y-4">
            <form onSubmit={form.handleSubmit((v) => addOverride.mutate(v))} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-6 sm:items-end">
              <Field label="Data" error={form.formState.errors.date?.message} className="sm:col-span-2">
                <Input type="date" min={today} {...form.register('date')} />
              </Field>
              <Field label="Tipo" className="sm:col-span-2">
                <Select {...form.register('type')}>
                  <option value="OFF">Folga (não atende)</option>
                  <option value="EXTRA">Jornada específica</option>
                </Select>
              </Field>
              {type === 'EXTRA' ? (
                <>
                  <Field label="Início" error={form.formState.errors.startTime?.message}>
                    <Input type="time" {...form.register('startTime')} />
                  </Field>
                  <Field label="Fim" error={form.formState.errors.endTime?.message}>
                    <Input type="time" {...form.register('endTime')} />
                  </Field>
                </>
              ) : (
                <div className="hidden sm:col-span-2 sm:block" />
              )}
              <Field label="Motivo (opcional)" className="sm:col-span-4">
                <Input {...form.register('reason')} placeholder="Férias, curso, feriado, plantão..." />
              </Field>
              <Button type="submit" className="sm:col-span-2" loading={addOverride.isPending}>
                {type === 'OFF' ? <CalendarOff /> : <CalendarPlus />} Adicionar
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">Um registro por dia: adicionar outro na mesma data substitui o anterior. A jornada específica substitui a jornada semanal naquele dia.</p>

            {isLoading ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : !overrides?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma folga ou jornada específica programada.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {overrides.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 p-3">
                    <Badge variant={o.type === 'OFF' ? 'destructive' : 'success'}>{o.type === 'OFF' ? 'Folga' : 'Jornada específica'}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium capitalize">{fmtDateLong(fromISODate(o.date))}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.type === 'EXTRA' ? `${o.startTime} às ${o.endTime}` : 'Dia inteiro'}
                        {o.reason ? ` · ${o.reason}` : ''}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeOverride.mutate(o.id)} disabled={removeOverride.isPending} aria-label="Remover">
                      <Trash2 className="text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default ProfessionalScheduleDialog;
