import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout, PasswordInput } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const { register, handleSubmit, formState } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormData) => {
    try {
      const data = await authApi.login(v.email.trim().toLowerCase(), v.password);
      toast.success(`Bem-vindo, ${data.user.name.split(' ')[0]}!`);
      if (data.current) navigate(location.state?.from?.pathname ?? '/app', { replace: true });
      else if (data.user.isSuperAdmin) navigate('/admin', { replace: true });
      else navigate('/cliente', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível entrar'));
    }
  };

  return (
    <AuthLayout
      title="Acessar o painel"
      subtitle="Entre com o e-mail e a senha cadastrados na barbearia."
      footer={
        <div className="space-y-2">
          <div>
            Ainda não tem conta?{' '}
            <Link to="/cadastro" className="font-medium text-primary hover:underline">
              Criar conta grátis
            </Link>
          </div>
          <div>
            É cliente de uma barbearia?{' '}
            <Link to="/cliente/login" className="font-medium text-primary hover:underline">
              Sou cliente
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="voce@barbearia.com" autoFocus {...register('email')} />
        </Field>
        <Field label="Senha" error={formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" placeholder="Sua senha" {...register('password')} />
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
