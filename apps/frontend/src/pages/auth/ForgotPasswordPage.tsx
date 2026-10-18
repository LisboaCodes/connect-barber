import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';

const schema = z.object({ email: z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormData) => {
    try {
      await authApi.forgot(v.email.trim().toLowerCase());
      setSentTo(v.email.trim());
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível enviar o e-mail'));
    }
  };

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sentTo ? (
        <div className="rounded-xl border bg-muted/40 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-3 font-semibold">Verifique seu e-mail</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Se existir uma conta para <strong>{sentTo}</strong>, você receberá em instantes um link para redefinir a senha. Confira também a caixa de spam.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setSentTo(null)}>
            Enviar novamente
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="E-mail" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus placeholder="voce@email.com" {...register('email')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
            Enviar link de redefinição
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
