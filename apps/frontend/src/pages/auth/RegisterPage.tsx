import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { AuthLayout, PasswordInput, UFS, maskPhone } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z.object({
  tenantName: z.string().trim().min(2, 'Informe o nome da barbearia').max(80),
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  phone: z.string().refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres').max(72),
  city: z.string().trim().optional(),
  state: z.string().optional(),
  ownerIsProfessional: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, control, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ownerIsProfessional: true, state: '', city: '', phone: '' },
  });

  const onSubmit = async (v: FormData) => {
    try {
      await authApi.register({
        tenantName: v.tenantName.trim(),
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        phone: v.phone,
        password: v.password,
        ownerIsProfessional: v.ownerIsProfessional,
        city: v.city || undefined,
        state: v.state || undefined,
      });
      toast.success('Conta criada! Vamos configurar sua barbearia.');
      navigate('/app/onboarding', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível criar a conta'));
    }
  };

  return (
    <AuthLayout
      title="Teste grátis por 30 dias"
      subtitle="Sem cartão de crédito. Todas as funcionalidades liberadas."
      sideTitle="Comece hoje e tenha sua agenda on-line em minutos"
      benefits={['30 dias grátis, sem limitação', 'Sem cartão de crédito', 'Não precisa de CNPJ', 'Passo a passo inicial guiado']}
      footer={
        <>
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome da barbearia" required error={formState.errors.tenantName?.message}>
          <Input placeholder="Ex.: Barbearia do Zé" autoFocus {...register('tenantName')} />
        </Field>
        <Field label="Seu nome" required error={formState.errors.name?.message}>
          <Input autoComplete="name" placeholder="Nome completo" {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" required error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" placeholder="voce@email.com" {...register('email')} />
          </Field>
          <Field label="Telefone / WhatsApp" required error={formState.errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <Input type="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={field.value} onChange={(e) => field.onChange(maskPhone(e.target.value))} onBlur={field.onBlur} />}
            />
          </Field>
        </div>
        <Field label="Senha" required error={formState.errors.password?.message} hint="Mínimo de 6 caracteres">
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-4">
          <Field label="Cidade">
            <Input autoComplete="address-level2" {...register('city')} />
          </Field>
          <Field label="UF">
            <Select {...register('state')}>
              <option value="">--</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Controller
          control={control}
          name="ownerIsProfessional"
          render={({ field }) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Eu também atendo como profissional</span>
                <span className="block text-xs text-muted-foreground">Cadastra você na agenda para receber agendamentos.</span>
              </span>
            </label>
          )}
        />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Criar minha conta grátis
        </Button>
        <p className="text-center text-xs text-muted-foreground">Ao criar a conta você concorda com os termos de uso e a política de privacidade.</p>
      </form>
    </AuthLayout>
  );
}
