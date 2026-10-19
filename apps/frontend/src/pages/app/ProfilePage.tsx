import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { KeyRound, UserRound } from 'lucide-react';
import { Avatar, Badge, Button, Field, ImageUpload, Input, PageHeader, Section } from '@/components/ui';
import { PasswordInput, maskPhone } from '@/components/auth/AuthLayout';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { ROLE_LABEL } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  phone: z.string().refine((v) => !v || v.replace(/\D/g, '').length >= 10, 'Telefone inválido'),
  avatarUrl: z.string().trim().refine((v) => !v || /^https?:\/\/.+/i.test(v), 'Informe uma URL válida (https://...)'),
});
type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(6, 'Mínimo de 6 caracteres').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'As senhas não conferem', path: ['confirm'] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: 'A nova senha deve ser diferente da atual', path: ['newPassword'] });
type PasswordData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const current = useAuthStore((s) => s.current);
  const memberships = useAuthStore((s) => s.memberships);

  const profile = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: maskPhone(user?.phone ?? ''), avatarUrl: user?.avatarUrl ?? '' },
  });
  const pwd = useForm<PasswordData>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const saveProfile = async (v: ProfileData) => {
    try {
      const data = await authApi.updateProfile({ name: v.name.trim(), phone: v.phone || undefined, avatarUrl: v.avatarUrl.trim() });
      profile.reset({ name: data?.name ?? v.name, phone: maskPhone(data?.phone ?? v.phone), avatarUrl: data?.avatarUrl ?? v.avatarUrl });
      toast.success('Perfil atualizado');
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível salvar'));
    }
  };

  const savePassword = async (v: PasswordData) => {
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      pwd.reset();
      toast.success('Senha alterada com sucesso');
    } catch (e) {
      toast.error(errorMessage(e, 'Não foi possível alterar a senha'));
    }
  };

  const avatarPreview = profile.watch('avatarUrl');
  const namePreview = profile.watch('name');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Meu perfil" description="Seus dados de acesso ao Connect Barber." />

      <div className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-5">
        <Avatar src={/^https?:\/\//i.test(avatarPreview) ? avatarPreview : null} name={namePreview || user?.name} size="xl" color="#d97706" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{namePreview || user?.name}</div>
          <div className="truncate text-sm text-muted-foreground">{user?.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {current && <Badge>{ROLE_LABEL[current.role] ?? current.role}</Badge>}
            {current && <Badge variant="outline">{current.tenant.name}</Badge>}
            {user?.isSuperAdmin && <Badge variant="secondary">Administrador da plataforma</Badge>}
          </div>
        </div>
      </div>

      <Section title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Dados pessoais</span>} description="O e-mail é usado para login e não pode ser alterado por aqui.">
        <form onSubmit={profile.handleSubmit(saveProfile)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={profile.formState.errors.name?.message}>
              <Input {...profile.register('name')} />
            </Field>
            <Field label="Telefone / WhatsApp" error={profile.formState.errors.phone?.message}>
              <Controller control={profile.control} name="phone" render={({ field }) => <Input type="tel" value={field.value} onChange={(e) => field.onChange(maskPhone(e.target.value))} onBlur={field.onBlur} placeholder="(11) 99999-9999" />} />
            </Field>
            <Field label="E-mail">
              <Input value={user?.email ?? ''} disabled />
            </Field>
            <Field label="Foto" error={profile.formState.errors.avatarUrl?.message} className="sm:col-span-2">
              <Controller control={profile.control} name="avatarUrl" render={({ field }) => <ImageUpload shape="circle" value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={profile.formState.isSubmitting} disabled={!profile.formState.isDirty}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </Section>

      <Section title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Alterar senha</span>} description="Use pelo menos 6 caracteres." className="mt-6">
        <form onSubmit={pwd.handleSubmit(savePassword)} className="space-y-4" noValidate>
          <Field label="Senha atual" error={pwd.formState.errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...pwd.register('currentPassword')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nova senha" error={pwd.formState.errors.newPassword?.message}>
              <PasswordInput autoComplete="new-password" {...pwd.register('newPassword')} />
            </Field>
            <Field label="Confirmar nova senha" error={pwd.formState.errors.confirm?.message}>
              <PasswordInput autoComplete="new-password" {...pwd.register('confirm')} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pwd.formState.isSubmitting}>
              Alterar senha
            </Button>
          </div>
        </form>
      </Section>

      {memberships.length > 1 && (
        <Section title="Barbearias vinculadas" className="mt-6">
          <ul className="divide-y">
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{m.tenant.name}</span>
                <Badge variant={m.tenantId === current?.tenantId ? 'default' : 'outline'}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
