import { useEffect, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Field, Input, Section, Select, Switch } from '@/components/ui';
import { useUpdateTenant, type Tenant } from '@/lib/api/tenant';

const schema = z.object({
  onlineBookingEnabled: z.boolean(),
  autoConfirm: z.boolean(),
  slotIntervalMin: z.coerce.number().int().min(5, 'Mín. 5').max(120, 'Máx. 120'),
  minAdvanceMin: z.coerce.number().int().min(0, 'Mín. 0'),
  maxAdvanceDays: z.coerce.number().int().min(1, 'Mín. 1').max(365, 'Máx. 365'),
  cancelLimitHours: z.coerce.number().int().min(0, 'Mín. 0'),
});
type FormValues = z.infer<typeof schema>;

const toForm = (t: Tenant): FormValues => ({
  onlineBookingEnabled: t.onlineBookingEnabled,
  autoConfirm: t.autoConfirm,
  slotIntervalMin: t.slotIntervalMin,
  minAdvanceMin: t.minAdvanceMin,
  maxAdvanceDays: t.maxAdvanceDays,
  cancelLimitHours: t.cancelLimitHours,
});

export function SwitchRow({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children}
    </div>
  );
}

export function BookingSettingsForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant('Regras de agendamento salvas');
  const { register, handleSubmit, reset, control, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(tenant) });
  useEffect(() => reset(toForm(tenant)), [tenant, reset]);

  return (
    <form onSubmit={handleSubmit((v) => update.mutate(v))} className="space-y-6">
      <Section title="Agendamento online" description="Regras para clientes que agendam pelo site ou aplicativo">
        <div className="divide-y">
          <SwitchRow title="Agendamento online ativo" description="Permite que clientes marquem horários pela sua página pública">
            <Controller control={control} name="onlineBookingEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </SwitchRow>
          <SwitchRow title="Confirmar automaticamente" description="Agendamentos online já entram como confirmados. Desative para aprovar manualmente.">
            <Controller control={control} name="autoConfirm" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </SwitchRow>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Intervalo entre horários" error={formState.errors.slotIntervalMin?.message} hint="De quanto em quanto tempo os horários são oferecidos">
            <Select {...register('slotIntervalMin')}>
              {[...new Set([5, 10, 15, 20, 30, 40, 45, 60, tenant.slotIntervalMin])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Antecedência mínima (minutos)" error={formState.errors.minAdvanceMin?.message} hint="Ex.: 60 = cliente só agenda com 1h de antecedência">
            <Input type="number" min={0} step={15} {...register('minAdvanceMin')} />
          </Field>
          <Field label="Agendar com até (dias)" error={formState.errors.maxAdvanceDays?.message} hint="Quantos dias à frente a agenda fica aberta">
            <Input type="number" min={1} max={365} {...register('maxAdvanceDays')} />
          </Field>
          <Field label="Cancelamento até (horas antes)" error={formState.errors.cancelLimitHours?.message} hint="Prazo para o cliente cancelar/remarcar online">
            <Input type="number" min={0} {...register('cancelLimitHours')} />
          </Field>
        </div>
      </Section>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

export default BookingSettingsForm;
