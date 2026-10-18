import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Section,
  Select,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { professionalsApi } from '@/lib/api/professionals';
import { tenantApi, type Member, type Role } from '@/lib/api/tenant';
import { ROLE_LABEL, fmtRelative } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';

const ROLE_HELP: Record<Role, string> = {
  OWNER: 'Acesso total, inclusive plano e financeiro',
  ADMIN: 'Gestão completa da barbearia, exceto transferir propriedade',
  RECEPTION: 'Agenda, clientes, comandas e caixa',
  PROFESSIONAL: 'Própria agenda, clientes e comissões',
};

const createSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome'),
    email: z.string().trim().email('E-mail inválido'),
    phone: z.string(),
    password: z.string(),
    role: z.enum(['OWNER', 'ADMIN', 'RECEPTION', 'PROFESSIONAL']),
    professionalId: z.string(),
  })
  .refine((v) => !v.password || v.password.length >= 6, { path: ['password'], message: 'Mínimo 6 caracteres' });
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z
  .object({
    role: z.enum(['OWNER', 'ADMIN', 'RECEPTION', 'PROFESSIONAL']),
    professionalId: z.string(),
    password: z.string(),
  })
  .refine((v) => !v.password || v.password.length >= 6, { path: ['password'], message: 'Mínimo 6 caracteres' });
type EditValues = z.infer<typeof editSchema>;

export function TeamSettings() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user?.id);
  const myRole = useAuthStore((s) => s.current?.role);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [password, setPassword] = useState<{ password: string; email: string } | null>(null);

  const { data: members, isLoading } = useQuery({ queryKey: ['tenant', 'members'], queryFn: tenantApi.members });
  const { data: pros } = useQuery({ queryKey: ['professionals', 'all'], queryFn: () => professionalsApi.list(true) });
  const roles = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== 'OWNER' || myRole === 'OWNER');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tenant', 'members'] });
    qc.invalidateQueries({ queryKey: ['professionals'] });
  };

  const toggle = useMutation({
    mutationFn: (m: Member) => tenantApi.updateMember(m.id, { isActive: !m.isActive }),
    onSuccess: (m) => {
      toast.success(m.isActive ? 'Acesso reativado' : 'Acesso desativado');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (m: Member) => tenantApi.removeMember(m.id),
    onSuccess: () => {
      toast.success('Acesso removido');
      setRemoving(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Section
      title="Equipe e acessos"
      description="Quem pode entrar no sistema e o que cada pessoa pode fazer"
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Novo acesso
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !members?.length ? (
        <EmptyState icon={Users} title="Nenhum membro" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Pessoa</TH>
              <TH>Perfil</TH>
              <TH className="hidden md:table-cell">Profissional vinculado</TH>
              <TH className="hidden lg:table-cell">Último acesso</TH>
              <TH className="w-10" />
            </TR>
          </THead>
          <TBody>
            {members.map((m) => (
              <TR key={m.id} className={!m.isActive ? 'opacity-60' : ''}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar src={m.user.avatarUrl} name={m.user.name} size="sm" color="#d97706" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="truncate">{m.user.name}</span>
                        {m.user.id === me && <Badge variant="outline">Você</Badge>}
                        {!m.isActive && <Badge variant="secondary">Desativado</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.user.email}</div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge variant={m.role === 'OWNER' ? 'default' : m.role === 'ADMIN' ? 'warning' : 'secondary'}>{ROLE_LABEL[m.role]}</Badge>
                </TD>
                <TD className="hidden md:table-cell text-muted-foreground">{m.professional?.name ?? '-'}</TD>
                <TD className="hidden lg:table-cell text-muted-foreground">{m.user.lastLoginAt ? fmtRelative(m.user.lastLoginAt) : 'Nunca'}</TD>
                <TD>
                  {(m.role !== 'OWNER' || myRole === 'OWNER') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Ações">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(m)}>
                          <Pencil /> Editar / redefinir senha
                        </DropdownMenuItem>
                        {m.user.id !== me && (
                          <>
                            <DropdownMenuItem onClick={() => toggle.mutate(m)}>
                              <Power /> {m.isActive ? 'Desativar acesso' : 'Reativar acesso'}
                            </DropdownMenuItem>
                            {m.role !== 'OWNER' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onClick={() => setRemoving(m)}>
                                  <Trash2 /> Remover
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <CreateMemberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        pros={(pros ?? []).filter((p) => !p.membershipId && p.isActive)}
        onCreated={(pw, email) => {
          invalidate();
          if (pw) setPassword({ password: pw, email });
        }}
      />
      <EditMemberDialog member={editing} onClose={() => setEditing(null)} roles={roles} pros={(pros ?? []).filter((p) => p.isActive && (!p.membershipId || p.membershipId === editing?.id))} onSaved={invalidate} />
      <GeneratedPasswordDialog password={password?.password ?? null} email={password?.email} onClose={() => setPassword(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remover acesso de ${removing?.user.name ?? ''}?`}
        description="A pessoa não poderá mais entrar nesta barbearia. Os registros feitos por ela são mantidos."
        confirmText="Remover"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </Section>
  );
}

function CreateMemberDialog({
  open,
  onOpenChange,
  roles,
  pros,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roles: Role[];
  pros: { id: string; name: string }[];
  onCreated: (password: string | undefined, email: string) => void;
}) {
  const defaults: CreateValues = { name: '', email: '', phone: '', password: '', role: 'RECEPTION', professionalId: '' };
  const { register, handleSubmit, reset, watch, formState } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: defaults });
  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);
  const role = watch('role');

  const mut = useMutation({
    mutationFn: (v: CreateValues) =>
      tenantApi.createMember({
        name: v.name,
        email: v.email,
        phone: v.phone || undefined,
        password: v.password || undefined,
        role: v.role,
        professionalId: v.professionalId || undefined,
      }),
    onSuccess: (r, v) => {
      toast.success(r.userExisted ? 'Acesso adicionado (a pessoa já tinha conta e usa a senha atual)' : 'Acesso criado');
      onCreated(r.generatedPassword && !v.password ? r.generatedPassword : undefined, v.email);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Novo acesso" description="A pessoa entra com o e-mail e a senha definidos aqui.">
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input autoFocus {...register('name')} />
            </Field>
            <Field label="E-mail (login)" required error={formState.errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label="Telefone">
              <Input inputMode="tel" {...register('phone')} />
            </Field>
            <Field label="Perfil" hint={ROLE_HELP[role]} className="sm:col-span-2">
              <Select {...register('role')}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vincular a profissional" hint={role === 'PROFESSIONAL' ? 'Se nenhum for escolhido, um novo profissional é criado automaticamente' : 'Opcional: para quem também atende'} className="sm:col-span-2">
              <Select {...register('professionalId')}>
                <option value="">{role === 'PROFESSIONAL' ? 'Criar novo profissional' : 'Nenhum'}</option>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Senha inicial" error={formState.errors.password?.message} hint="Em branco = gerar automaticamente" className="sm:col-span-2">
              <Input type="text" autoComplete="new-password" {...register('password')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose, roles, pros, onSaved }: { member: Member | null; onClose: () => void; roles: Role[]; pros: { id: string; name: string }[]; onSaved: () => void }) {
  const { register, handleSubmit, reset, watch, formState } = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: { role: 'RECEPTION', professionalId: '', password: '' } });
  useEffect(() => {
    if (member) reset({ role: member.role, professionalId: member.professional?.id ?? '', password: '' });
  }, [member, reset]);
  const role = watch('role');

  const mut = useMutation({
    mutationFn: (v: EditValues) =>
      tenantApi.updateMember(member!.id, {
        role: v.role !== member!.role ? v.role : undefined,
        professionalId: v.professionalId !== (member!.professional?.id ?? '') ? v.professionalId || null : undefined,
        password: v.password || undefined,
      }),
    onSuccess: (_r, v) => {
      toast.success(v.password ? 'Acesso atualizado e senha redefinida' : 'Acesso atualizado');
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const roleOptions = member && !roles.includes(member.role) ? [member.role, ...roles] : roles;

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" title={`Editar acesso`} description={member ? `${member.user.name} · ${member.user.email}` : undefined}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <Field label="Perfil" hint={ROLE_HELP[role]}>
            <Select {...register('role')}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profissional vinculado">
            <Select {...register('professionalId')}>
              <option value="">Nenhum</option>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {member?.professional && !pros.some((p) => p.id === member.professional!.id) && <option value={member.professional.id}>{member.professional.name}</option>}
            </Select>
          </Field>
          <Field label="Nova senha" error={formState.errors.password?.message} hint="Deixe em branco para manter. Ao redefinir, as sessões abertas são encerradas.">
            <Input type="text" autoComplete="new-password" {...register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TeamSettings;
