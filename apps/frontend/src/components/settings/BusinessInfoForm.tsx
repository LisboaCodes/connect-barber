import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Field, Input, Section, Select, Textarea } from '@/components/ui';
import { useUpdateTenant, type Tenant } from '@/lib/api/tenant';
import { useAuthStore } from '@/store/auth.store';

const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (GMT-3)'],
  ['America/Bahia', 'Bahia (GMT-3)'],
  ['America/Fortaleza', 'Fortaleza (GMT-3)'],
  ['America/Recife', 'Recife (GMT-3)'],
  ['America/Belem', 'Belém (GMT-3)'],
  ['America/Manaus', 'Manaus (GMT-4)'],
  ['America/Cuiaba', 'Cuiabá (GMT-4)'],
  ['America/Campo_Grande', 'Campo Grande (GMT-4)'],
  ['America/Porto_Velho', 'Porto Velho (GMT-4)'],
  ['America/Boa_Vista', 'Boa Vista (GMT-4)'],
  ['America/Rio_Branco', 'Rio Branco (GMT-5)'],
  ['America/Noronha', 'Fernando de Noronha (GMT-2)'],
];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(80),
  legalName: z.string(),
  document: z.string(),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')),
  phone: z.string(),
  whatsapp: z.string(),
  description: z.string().max(2000),
  logoUrl: z.string().trim().url('URL inválida').or(z.literal('')),
  timezone: z.string(),
  addressZip: z.string(),
  addressStreet: z.string(),
  addressNumber: z.string(),
  addressComplement: z.string(),
  addressDistrict: z.string(),
  addressCity: z.string(),
  addressState: z.string(),
});
type FormValues = z.infer<typeof schema>;

const toForm = (t: Tenant): FormValues => ({
  name: t.name ?? '',
  legalName: t.legalName ?? '',
  document: t.document ?? '',
  email: t.email ?? '',
  phone: t.phone ?? '',
  whatsapp: t.whatsapp ?? '',
  description: t.description ?? '',
  logoUrl: t.logoUrl ?? '',
  timezone: t.timezone ?? 'America/Sao_Paulo',
  addressZip: t.addressZip ?? '',
  addressStreet: t.addressStreet ?? '',
  addressNumber: t.addressNumber ?? '',
  addressComplement: t.addressComplement ?? '',
  addressDistrict: t.addressDistrict ?? '',
  addressCity: t.addressCity ?? '',
  addressState: t.addressState ?? '',
});

export function BusinessInfoForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant('Dados da barbearia salvos');
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(tenant) });
  useEffect(() => reset(toForm(tenant)), [tenant, reset]);

  const lookupCep = async () => {
    const cep = watch('addressZip').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setValue('addressStreet', d.logradouro || watch('addressStreet'), { shouldDirty: true });
      setValue('addressDistrict', d.bairro || watch('addressDistrict'), { shouldDirty: true });
      setValue('addressCity', d.localidade || watch('addressCity'), { shouldDirty: true });
      setValue('addressState', d.uf || watch('addressState'), { shouldDirty: true });
    } catch {
      /* consulta de CEP é opcional */
    }
  };

  const onSubmit = (v: FormValues) => {
    const nul = (s: string) => (s.trim() ? s.trim() : null);
    update.mutate(
      {
        name: v.name.trim(),
        legalName: nul(v.legalName),
        document: nul(v.document),
        email: nul(v.email),
        phone: nul(v.phone),
        whatsapp: nul(v.whatsapp),
        description: nul(v.description),
        logoUrl: nul(v.logoUrl),
        timezone: v.timezone,
        addressZip: nul(v.addressZip),
        addressStreet: nul(v.addressStreet),
        addressNumber: nul(v.addressNumber),
        addressComplement: nul(v.addressComplement),
        addressDistrict: nul(v.addressDistrict),
        addressCity: nul(v.addressCity),
        addressState: nul(v.addressState),
      },
      { onSuccess: (t) => useAuthStore.getState().updateCurrentTenant({ name: t.name, logoUrl: t.logoUrl }) },
    );
  };

  const logo = watch('logoUrl');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Identificação" description="Como sua barbearia aparece para clientes e nos comprovantes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da barbearia" required error={formState.errors.name?.message}>
            <Input {...register('name')} />
          </Field>
          <Field label="Razão social">
            <Input {...register('legalName')} />
          </Field>
          <Field label="CPF / CNPJ">
            <Input {...register('document')} />
          </Field>
          <Field label="E-mail" error={formState.errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Telefone">
            <Input inputMode="tel" {...register('phone')} placeholder="(11) 3333-4444" />
          </Field>
          <Field label="WhatsApp">
            <Input inputMode="tel" {...register('whatsapp')} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="URL do logotipo" error={formState.errors.logoUrl?.message} className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {logo && !formState.errors.logoUrl && <img src={logo} alt="" className="h-9 w-9 rounded-md border object-cover" />}
              <Input {...register('logoUrl')} placeholder="https://..." />
            </div>
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea rows={3} {...register('description')} placeholder="Barbearia clássica com atendimento personalizado..." />
          </Field>
          <Field label="Fuso horário">
            <Select {...register('timezone')}>
              {TIMEZONES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" className="sm:col-span-2" hint="Preenche o endereço automaticamente">
            <Input inputMode="numeric" {...register('addressZip')} onBlur={lookupCep} placeholder="00000-000" />
          </Field>
          <Field label="Rua" className="sm:col-span-4">
            <Input {...register('addressStreet')} />
          </Field>
          <Field label="Número" className="sm:col-span-2">
            <Input {...register('addressNumber')} />
          </Field>
          <Field label="Complemento" className="sm:col-span-4">
            <Input {...register('addressComplement')} />
          </Field>
          <Field label="Bairro" className="sm:col-span-2">
            <Input {...register('addressDistrict')} />
          </Field>
          <Field label="Cidade" className="sm:col-span-3">
            <Input {...register('addressCity')} />
          </Field>
          <Field label="UF" className="sm:col-span-1">
            <Select {...register('addressState')}>
              <option value="">-</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
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

export default BusinessInfoForm;
