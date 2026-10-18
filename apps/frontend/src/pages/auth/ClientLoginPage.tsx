import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout, CLIENT_BENEFITS, PasswordInput } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
});
type FormData = z.infer<typeof schema>;

export default function ClientLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const { register, handleSubmit, formState } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormData) => {
    try {
      const data = await authApi.login(v.email.trim().toLowerCase(), v.password);
      toast.success(`Olá, ${data.user.name.split(' ')[0]}!`);
      navigate(redirect ?? '/cliente', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível entrar'));
    }
  };

  const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  return (
    <AuthLayout
      title="Área do cliente"
      subtitle="Entre para agendar e acompanhar seus horários."
      sideTitle="Seu horário na barbearia, na palma da mão"
      sideText="Agende, remarque e acompanhe seus atendimentos e pontos de fidelidade nas barbearias que usam o Connect Barber."
      benefits={CLIENT_BENEFITS}
      footer={
        <div className="space-y-2">
          <div>
            Ainda não tem cadastro?{' '}
            <Link to={`/cliente/cadastro${qs}`} className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </div>
          <div>
            Trabalha em uma barbearia?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Acessar o painel
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus placeholder="voce@email.com" {...register('email')} />
        </Field>
        <Field label="Senha" error={formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-sm font-medium text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
