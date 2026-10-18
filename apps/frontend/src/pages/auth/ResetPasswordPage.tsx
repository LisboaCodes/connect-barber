import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button, Field } from '@/components/ui';
import { AuthLayout, PasswordInput } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo de 6 caracteres').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormData) => {
    if (!token) return;
    try {
      await authApi.reset(token, v.password);
      toast.success('Senha redefinida! Entre com a nova senha.');
      navigate('/login', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Link inválido ou expirado'));
    }
  };

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="Escolha uma senha nova para acessar sua conta."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {!token ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-2 font-semibold">Link inválido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Este link de redefinição está incompleto ou expirou. Solicite um novo.</p>
          <Button className="mt-4" asChild>
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Nova senha" error={formState.errors.password?.message} hint="Mínimo de 6 caracteres">
            <PasswordInput autoComplete="new-password" autoFocus {...register('password')} />
          </Field>
          <Field label="Confirmar nova senha" error={formState.errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...register('confirm')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
