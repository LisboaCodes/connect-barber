import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout, CLIENT_BENEFITS, PasswordInput, maskPhone } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  phone: z.string().refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres').max(72),
});
type FormData = z.infer<typeof schema>;

export default function ClientRegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const { register, handleSubmit, control, formState } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });

  const onSubmit = async (v: FormData) => {
    try {
      await authApi.registerClient({ name: v.name.trim(), email: v.email.trim().toLowerCase(), phone: v.phone, password: v.password });
      toast.success('Cadastro realizado!');
      navigate(redirect ?? '/cliente', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível concluir o cadastro'));
    }
  };

  const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  return (
    <AuthLayout
      title="Criar conta de cliente"
      subtitle="Gratuito. Use para agendar em qualquer barbearia Connect Barber."
      sideTitle="Seu horário na barbearia, na palma da mão"
      sideText="Cadastre-se uma vez e agende sempre que quiser, sem precisar ligar ou mandar mensagem."
      benefits={CLIENT_BENEFITS}
      footer={
        <>
          Já tem cadastro?{' '}
          <Link to={`/cliente/login${qs}`} className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome" required error={formState.errors.name?.message}>
          <Input autoComplete="name" autoFocus placeholder="Seu nome completo" {...register('name')} />
        </Field>
        <Field label="E-mail" required error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="voce@email.com" {...register('email')} />
        </Field>
        <Field label="Celular / WhatsApp" required error={formState.errors.phone?.message} hint="Usado para lembretes do seu horário">
          <Controller
            control={control}
            name="phone"
            render={({ field }) => <Input type="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={field.value} onChange={(e) => field.onChange(maskPhone(e.target.value))} onBlur={field.onBlur} />}
          />
        </Field>
        <Field label="Senha" required error={formState.errors.password?.message} hint="Mínimo de 6 caracteres">
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
