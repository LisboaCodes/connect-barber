import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { professionalsApi, type Professional, type ProfessionalInput } from '@/lib/api/professionals';
import { servicesApi } from '@/lib/api/services';
import { money, minutes } from '@/lib/utils/format';

const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

const schema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome').max(80),
    phone: z.string().trim(),
    email: z.string().trim().email('E-mail inválido').or(z.literal('')),
    bio: z.string().max(1000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
    displayOrder: z.coerce.number().int().min(0),
    showOnSite: z.boolean(),
    acceptsOnlineBooking: z.boolean(),
    isActive: z.boolean(),
    serviceCommissionPct: z.coerce.number().min(0, 'Mín. 0%').max(100, 'Máx. 100%'),
    productCommissionPct: z.coerce.number().min(0, 'Mín. 0%').max(100, 'Máx. 100%'),
    createAccess: z.boolean(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.createAccess && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Informe o e-mail para criar o acesso' });
    if (v.createAccess && v.password && v.password.length < 6) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mínimo 6 caracteres' });
  });
type FormValues = z.infer<typeof schema>;

const toForm = (p?: Professional | null, count = 0): FormValues => ({
  name: p?.name ?? '',
  phone: p?.phone ?? '',
  email: p?.email ?? '',
  bio: p?.bio ?? '',
  color: p?.color ?? PALETTE[count % PALETTE.length],
  displayOrder: p?.displayOrder ?? count,
  showOnSite: p?.showOnSite ?? true,
  acceptsOnlineBooking: p?.acceptsOnlineBooking ?? true,
  isActive: p?.isActive ?? true,
  serviceCommissionPct: Number(p?.serviceCommissionPct ?? 40),
  productCommissionPct: Number(p?.productCommissionPct ?? 10),
  createAccess: false,
  password: '',
});

export function ProfessionalFormDialog({
  open,
  onOpenChange,
  professional,
  count = 0,
  onPassword,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professional?: Professional | null;
  count?: number;
  onPassword?: (password: string, email: string | null) => void;
}) {
  const qc = useQueryClient();
  const editing = !!professional;
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const { data: services } = useQuery({ queryKey: ['services', 'all'], queryFn: () => servicesApi.list(true), enabled: open });
  const { register, handleSubmit, reset, control, watch, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(professional, count) });

  useEffect(() => {
    if (open) {
      reset(toForm(professional, count));
      setServiceIds(professional?.services.map((s) => s.serviceId) ?? []);
    }
  }, [open, professional, count, reset]);

  const mut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: ProfessionalInput = {
        name: v.name,
        phone: v.phone || undefined,
        email: v.email || undefined,
        bio: v.bio || undefined,
        color: v.color,
        displayOrder: v.displayOrder,
        showOnSite: v.showOnSite,
        acceptsOnlineBooking: v.acceptsOnlineBooking,
        isActive: v.isActive,
        serviceCommissionPct: v.serviceCommissionPct,
        productCommissionPct: v.productCommissionPct,
        serviceIds,
        createAccess: v.createAccess || undefined,
        password: v.createAccess && v.password ? v.password : undefined,
      };
      return editing ? professionalsApi.update(professional!.id, payload) : professionalsApi.create(payload);
    },
    onSuccess: (p) => {
      toast.success(editing ? 'Profissional atualizado' : 'Profissional cadastrado');
      qc.invalidateQueries({ queryKey: ['professionals'] });
      if (p.generatedPassword) onPassword?.(p.generatedPassword, p.email);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const createAccess = watch('createAccess');
  const color = watch('color');
  const hasAccess = !!professional?.membership;
  const activeServices = (services ?? []).filter((s) => s.isActive || serviceIds.includes(s.id));
  const toggle = (id: string) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={editing ? 'Editar profissional' : 'Novo profissional'}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input autoFocus {...register('name')} />
            </Field>
            <Field label="Telefone">
              <Input {...register('phone')} inputMode="tel" placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail" error={formState.errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label="Cor na agenda" error={formState.errors.color?.message}>
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setValue('color', c, { shouldDirty: true })}
                    className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" {...register('color')} className="h-7 w-9 cursor-pointer rounded border bg-transparent" style={{ borderColor: color }} />
              </div>
            </Field>
            <Field label="Ordem de exibição">
              <Input type="number" min={0} {...register('displayOrder')} />
            </Field>
            <Field label="Comissão sobre serviços" error={formState.errors.serviceCommissionPct?.message}>
              <Input type="number" step="0.5" min={0} max={100} suffix="%" {...register('serviceCommissionPct')} />
            </Field>
            <Field label="Comissão sobre produtos" error={formState.errors.productCommissionPct?.message}>
              <Input type="number" step="0.5" min={0} max={100} suffix="%" {...register('productCommissionPct')} />
            </Field>
            <Field label="Apresentação (bio)" className="sm:col-span-2" hint="Aparece no site de agendamento">
              <Textarea rows={2} {...register('bio')} placeholder="Especialista em degradê e barba..." />
            </Field>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            {(
              [
                ['isActive', 'Ativo'],
                ['showOnSite', 'Aparece no site'],
                ['acceptsOnlineBooking', 'Aceita agendamento online'],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <Label className="flex items-center gap-2 font-normal">
                    <Switch checked={field.value} onCheckedChange={field.onChange} /> {label}
                  </Label>
                )}
              />
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Serviços que realiza</Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setServiceIds(activeServices.map((s) => s.id))}>
                  Marcar todos
                </button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setServiceIds([])}>
                  Limpar
                </button>
              </div>
            </div>
            {!activeServices.length ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-auto rounded-lg border p-2 sm:grid-cols-2">
                {activeServices.map((s) => (
                  <Label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-normal hover:bg-muted">
                    <Checkbox checked={serviceIds.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {minutes(s.durationMinutes)} · {money(s.price)}
                    </span>
                  </Label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Nenhum marcado = realiza todos os serviços.</p>
          </div>

          {hasAccess ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              Acesso ao sistema: <span className="font-medium">{professional!.membership!.user.email}</span>
              {!professional!.membership!.isActive && <span className="ml-2 text-red-600">(desativado)</span>}
              <div className="text-xs text-muted-foreground">Gerencie senhas e permissões em Configurações › Equipe e acessos.</div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border p-3">
              <Controller
                control={control}
                name="createAccess"
                render={({ field }) => (
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                    Criar acesso ao sistema para este profissional (vê a própria agenda e comissões)
                  </Label>
                )}
              />
              {createAccess && (
                <Field label="Senha inicial" error={formState.errors.password?.message} hint="Deixe em branco para gerar uma senha automaticamente. O login será o e-mail informado.">
                  <Input type="text" autoComplete="new-password" {...register('password')} />
                </Field>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProfessionalFormDialog;
