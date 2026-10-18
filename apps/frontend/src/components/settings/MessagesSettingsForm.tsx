import { useEffect, useRef } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Field, Label, Section, Select, Switch, Textarea } from '@/components/ui';
import { useUpdateTenant, type Tenant } from '@/lib/api/tenant';
import { SwitchRow } from './BookingSettingsForm';

export const DEFAULT_TEMPLATES = {
  confirmation: 'Olá {{cliente}}! Seu horário na {{barbearia}} está marcado para {{data}} às {{hora}} com {{profissional}} ({{servicos}}). Até lá! 💈',
  reminder: 'Olá {{cliente}}, lembrete do seu horário na {{barbearia}}: {{data}} às {{hora}} com {{profissional}} ({{servicos}}). Se precisar remarcar, responda esta mensagem.',
  cancellation: 'Olá {{cliente}}, seu horário de {{data}} às {{hora}} na {{barbearia}} foi cancelado. Para remarcar, acesse {{link}}.',
};
export const DEFAULT_BIRTHDAY = 'Feliz aniversário, {{cliente}}! 🎉 A {{barbearia}} deseja um dia incrível. Passe aqui para comemorar com um visual novo: {{link}}';

const VARS = ['cliente', 'barbearia', 'data', 'hora', 'profissional', 'servicos', 'link'];
const SAMPLE: Record<string, string> = { cliente: 'João', barbearia: 'Sua Barbearia', data: '25/10', hora: '14:30', profissional: 'Carlos', servicos: 'Corte + Barba', link: 'connectbarber.com.br/b/sua-barbearia' };
const render = (t: string, barbearia: string) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k === 'barbearia' ? barbearia : SAMPLE[k] ?? `{{${k}}}`));

const schema = z.object({
  reminderEnabled: z.boolean(),
  reminderHoursBefore: z.coerce.number().int().min(1, 'Mín. 1h').max(168, 'Máx. 168h'),
  channelWhatsapp: z.boolean(),
  channelEmail: z.boolean(),
  birthdayMessageEnabled: z.boolean(),
  birthdayMessage: z.string().max(1000),
  surveyEnabled: z.boolean(),
  confirmation: z.string().min(5, 'Mensagem muito curta').max(1000),
  reminder: z.string().min(5, 'Mensagem muito curta').max(1000),
  cancellation: z.string().min(5, 'Mensagem muito curta').max(1000),
});
type FormValues = z.infer<typeof schema>;

const toForm = (t: Tenant): FormValues => {
  const tpl = { ...DEFAULT_TEMPLATES, ...((t.settings?.templates as Record<string, string>) ?? {}) };
  const ch = Array.isArray(t.reminderChannels) ? t.reminderChannels : ['WHATSAPP'];
  return {
    reminderEnabled: t.reminderEnabled,
    reminderHoursBefore: t.reminderHoursBefore,
    channelWhatsapp: ch.includes('WHATSAPP'),
    channelEmail: ch.includes('EMAIL'),
    birthdayMessageEnabled: t.birthdayMessageEnabled,
    birthdayMessage: t.birthdayMessage ?? DEFAULT_BIRTHDAY,
    surveyEnabled: t.surveyEnabled,
    confirmation: tpl.confirmation,
    reminder: tpl.reminder,
    cancellation: tpl.cancellation,
  };
};

function TemplateField({ form, name, label, hint, barbearia }: { form: UseFormReturn<FormValues>; name: 'confirmation' | 'reminder' | 'cancellation' | 'birthdayMessage'; label: string; hint?: string; barbearia: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const { ref: rhfRef, ...reg } = form.register(name);
  const value = form.watch(name) ?? '';
  const insert = (v: string) => {
    const el = ref.current;
    const token = `{{${v}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    form.setValue(name, value.slice(0, start) + token + value.slice(end), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const reset = () => form.setValue(name, name === 'birthdayMessage' ? DEFAULT_BIRTHDAY : DEFAULT_TEMPLATES[name], { shouldDirty: true });
  return (
    <Field label={label} error={form.formState.errors[name]?.message} hint={hint}>
      <Textarea
        rows={3}
        {...reg}
        ref={(el) => {
          rhfRef(el);
          ref.current = el;
        }}
      />
      <div className="flex flex-wrap items-center gap-1">
        {VARS.map((v) => (
          <button key={v} type="button" onClick={() => insert(v)} className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">
            {`{{${v}}}`}
          </button>
        ))}
        <button type="button" onClick={reset} className="ml-auto text-xs text-muted-foreground hover:underline">
          Restaurar padrão
        </button>
      </div>
      <div className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">
        <span className="font-semibold">Prévia: </span>
        {render(value, barbearia)}
      </div>
    </Field>
  );
}

export function MessagesSettingsForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant('Mensagens automáticas salvas');
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(tenant) });
  const { register, handleSubmit, reset, control, watch, formState } = form;
  useEffect(() => reset(toForm(tenant)), [tenant, reset]);

  const onSubmit = (v: FormValues) => {
    const channels = [v.channelWhatsapp && 'WHATSAPP', v.channelEmail && 'EMAIL'].filter(Boolean) as string[];
    update.mutate({
      reminderEnabled: v.reminderEnabled,
      reminderHoursBefore: v.reminderHoursBefore,
      reminderChannels: channels,
      birthdayMessageEnabled: v.birthdayMessageEnabled,
      birthdayMessage: v.birthdayMessage,
      surveyEnabled: v.surveyEnabled,
      settings: { ...(tenant.settings ?? {}), templates: { confirmation: v.confirmation, reminder: v.reminder, cancellation: v.cancellation } },
    });
  };

  const reminderOn = watch('reminderEnabled');
  const birthdayOn = watch('birthdayMessageEnabled');
  const noChannel = reminderOn && !watch('channelWhatsapp') && !watch('channelEmail');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Lembretes e automações">
        <div className="divide-y">
          <SwitchRow title="Lembrete de horário" description="Envia um lembrete antes de cada agendamento">
            <Controller control={control} name="reminderEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </SwitchRow>
          {reminderOn && (
            <div className="grid gap-4 py-3 sm:grid-cols-2">
              <Field label="Enviar com antecedência de" error={formState.errors.reminderHoursBefore?.message}>
                <Select {...register('reminderHoursBefore')}>
                  {[...new Set([1, 2, 3, 4, 6, 12, 24, 48, 72, tenant.reminderHoursBefore])].sort((a, b) => a - b).map((h) => (
                    <option key={h} value={h}>
                      {h} hora(s)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Canais" error={noChannel ? 'Selecione ao menos um canal' : undefined}>
                <div className="flex h-9 items-center gap-5">
                  <Controller
                    control={control}
                    name="channelWhatsapp"
                    render={({ field }) => (
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /> WhatsApp
                      </Label>
                    )}
                  />
                  <Controller
                    control={control}
                    name="channelEmail"
                    render={({ field }) => (
                      <Label className="flex items-center gap-2 font-normal">
                        <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /> E-mail
                      </Label>
                    )}
                  />
                </div>
              </Field>
            </div>
          )}
          <SwitchRow title="Mensagem de aniversário" description="Enviada automaticamente no dia do aniversário do cliente">
            <Controller control={control} name="birthdayMessageEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </SwitchRow>
          {birthdayOn && (
            <div className="py-3">
              <TemplateField form={form} name="birthdayMessage" label="Texto de aniversário" barbearia={tenant.name} />
            </div>
          )}
          <SwitchRow title="Pesquisa de satisfação" description="Envia um link de avaliação após o atendimento finalizado">
            <Controller control={control} name="surveyEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </SwitchRow>
        </div>
      </Section>

      <Section title="Modelos de mensagem" description="Clique em uma variável para inseri-la no texto na posição do cursor">
        <div className="space-y-6">
          <TemplateField form={form} name="confirmation" label="Confirmação de agendamento" barbearia={tenant.name} />
          <TemplateField form={form} name="reminder" label="Lembrete" barbearia={tenant.name} />
          <TemplateField form={form} name="cancellation" label="Cancelamento" barbearia={tenant.name} />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!formState.isDirty || noChannel}>
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

export default MessagesSettingsForm;
