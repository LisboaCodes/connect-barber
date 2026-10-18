import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui';
import { fmtPhone } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import { clientAreaApi } from '@/lib/api/clientArea';
import { useAuthStore } from '@/store/auth.store';

const digits = (s: string) => s.replace(/\D/g, '');

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || digits(v).length >= 10, 'Telefone inválido (inclua o DDD)'),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' });
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfileView() {
  const user = useAuthStore((s) => s.user);

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ? fmtPhone(user.phone) : '' },
  });
  const password = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const saveProfile = useMutation({
    mutationFn: async (v: ProfileForm) => {
      const phone = digits(v.phone);
      await authApi.updateProfile({ name: v.name.trim(), ...(phone ? { phone } : {}) });
      // vincula o telefone aos cadastros nas barbearias
      if (phone && phone !== digits(user?.phone ?? '')) await clientAreaApi.updatePhone(phone);
    },
    onSuccess: () => toast.success('Dados atualizados'),
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível salvar')),
  });

  const savePassword = useMutation({
    mutationFn: (v: PasswordForm) => authApi.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success('Senha alterada');
      password.reset();
    },
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível alterar a senha')),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar src={user?.avatarUrl} name={user?.name} size="xl" color="#d97706" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user?.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus dados</CardTitle>
          <CardDescription>Seu telefone é usado pelas barbearias para lembretes e confirmações.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={profile.handleSubmit((v) => saveProfile.mutate(v))}>
            <Field label="Nome" required error={profile.formState.errors.name?.message}>
              <Input autoComplete="name" {...profile.register('name')} />
            </Field>
            <Field label="Telefone (WhatsApp)" error={profile.formState.errors.phone?.message}>
              <Input inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" {...profile.register('phone')} />
            </Field>
            <Field label="E-mail" hint="O e-mail não pode ser alterado." className="sm:col-span-2">
              <Input value={user?.email ?? ''} disabled readOnly />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saveProfile.isPending}>
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={password.handleSubmit((v) => savePassword.mutate(v))}>
            <Field label="Senha atual" error={password.formState.errors.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...password.register('currentPassword')} />
            </Field>
            <Field label="Nova senha" error={password.formState.errors.newPassword?.message}>
              <Input type="password" autoComplete="new-password" {...password.register('newPassword')} />
            </Field>
            <Field label="Confirmar nova senha" error={password.formState.errors.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...password.register('confirm')} />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit" variant="outline" loading={savePassword.isPending}>
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
