import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, MoneyInput, Select, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { professionalsApi } from '@/lib/api/professionals';
import { servicesApi, type Service, type ServiceCategory, type ServiceInput } from '@/lib/api/services';

const optInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), `Entre ${min} e ${max}`);

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(80),
  categoryId: z.string(),
  durationMinutes: z.coerce.number().int('Minutos inteiros').min(5, 'Mín. 5 min').max(600, 'Máx. 600 min'),
  price: z.number({ invalid_type_error: 'Informe o preço' }).min(0),
  costPrice: z.number().min(0),
  commissionPct: z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= 0 && Number(v.replace(',', '.')) <= 100), 'Entre 0 e 100'),
  color: z.string(),
  description: z.string().max(1000),
  allowOnlineBooking: z.boolean(),
  isActive: z.boolean(),
  returnDays: optInt(1, 365),
  loyaltyPoints: optInt(0, 100000),
});
type FormValues = z.infer<typeof schema>;

const DURATIONS = [15, 20, 30, 40, 45, 60, 75, 90, 120];

const toForm = (s?: Service | null, categoryId?: string): FormValues => ({
  name: s?.name ?? '',
  categoryId: s?.categoryId ?? categoryId ?? '',
  durationMinutes: s?.durationMinutes ?? 30,
  price: Number(s?.price ?? 0),
  costPrice: Number(s?.costPrice ?? 0),
  commissionPct: s?.commissionPct === null || s?.commissionPct === undefined ? '' : String(s.commissionPct),
  color: s?.color ?? '#f59e0b',
  description: s?.description ?? '',
  allowOnlineBooking: s?.allowOnlineBooking ?? true,
  isActive: s?.isActive ?? true,
  returnDays: s?.returnDays ? String(s.returnDays) : '',
  loyaltyPoints: s?.loyaltyPoints === null || s?.loyaltyPoints === undefined ? '' : String(s.loyaltyPoints),
});

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  categories,
  defaultCategoryId,
  nextOrder = 0,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  service?: Service | null;
  categories: ServiceCategory[];
  defaultCategoryId?: string;
  nextOrder?: number;
}) {
  const qc = useQueryClient();
  const editing = !!service;
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const { data: pros } = useQuery({ queryKey: ['professionals', 'active'], queryFn: () => professionalsApi.list(false), enabled: open });
  const { register, handleSubmit, reset, control, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(service, defaultCategoryId) });

  useEffect(() => {
    if (open) {
      reset(toForm(service, defaultCategoryId));
      setProfessionalIds(service?.professionals.map((p) => p.professionalId) ?? []);
    }
  }, [open, service, defaultCategoryId, reset]);

  const mut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: ServiceInput = {
        name: v.name,
        categoryId: v.categoryId || null,
        durationMinutes: v.durationMinutes,
        price: v.price,
        costPrice: v.costPrice,
        commissionPct: v.commissionPct === '' ? null : Number(v.commissionPct.replace(',', '.')),
        color: v.color,
        description: v.description || undefined,
        allowOnlineBooking: v.allowOnlineBooking,
        isActive: v.isActive,
        returnDays: v.returnDays === '' ? null : Number(v.returnDays),
        loyaltyPoints: v.loyaltyPoints === '' ? null : Number(v.loyaltyPoints),
        professionalIds,
        ...(editing ? {} : { displayOrder: nextOrder }),
      };
      return editing ? servicesApi.update(service!.id, payload) : servicesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Serviço atualizado' : 'Serviço cadastrado');
      qc.invalidateQueries({ queryKey: ['services'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggle = (id: string) => setProfessionalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={editing ? 'Editar serviço' : 'Novo serviço'}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nome" required error={formState.errors.name?.message} className="sm:col-span-4">
              <Input autoFocus {...register('name')} placeholder="Corte masculino" />
            </Field>
            <Field label="Cor" className="sm:col-span-2">
              <input type="color" {...register('color')} className="h-9 w-full cursor-pointer rounded-md border bg-transparent px-1" />
            </Field>
            <Field label="Categoria" className="sm:col-span-3">
              <Select {...register('categoryId')}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração (min)" required error={formState.errors.durationMinutes?.message} className="sm:col-span-3">
              <Input type="number" min={5} max={600} step={5} list="service-durations" {...register('durationMinutes')} />
              <datalist id="service-durations">
                {DURATIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="Preço" required error={formState.errors.price?.message} className="sm:col-span-2">
              <Controller control={control} name="price" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Custo" hint="Insumos por atendimento" className="sm:col-span-2">
              <Controller control={control} name="costPrice" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Comissão" hint="Vazio = usa a do profissional" error={formState.errors.commissionPct?.message} className="sm:col-span-2">
              <Input inputMode="decimal" suffix="%" {...register('commissionPct')} />
            </Field>
            <Field label="Retorno (dias)" hint="Lembrete automático de retorno" error={formState.errors.returnDays?.message} className="sm:col-span-3">
              <Input type="number" min={1} max={365} {...register('returnDays')} placeholder="Ex.: 30" />
            </Field>
            <Field label="Pontos de fidelidade" hint="Vazio = regra padrão do programa" error={formState.errors.loyaltyPoints?.message} className="sm:col-span-3">
              <Input type="number" min={0} {...register('loyaltyPoints')} />
            </Field>
            <Field label="Descrição" className="sm:col-span-6" hint="Exibida no site de agendamento">
              <Textarea rows={2} {...register('description')} />
            </Field>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:gap-8">
            <Controller
              control={control}
              name="allowOnlineBooking"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal">
                  <Switch checked={field.value} onCheckedChange={field.onChange} /> Disponível no agendamento online
                </Label>
              )}
            />
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal">
                  <Switch checked={field.value} onCheckedChange={field.onChange} /> Ativo
                </Label>
              )}
            />
          </div>

          <div>
            <Label className="mb-2 block">Profissionais que realizam</Label>
            {!pros?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum profissional ativo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pros.map((p) => (
                  <Label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 font-normal hover:bg-muted">
                    <Checkbox checked={professionalIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </Label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Nenhum marcado = todos os profissionais realizam.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              {editing ? 'Salvar' : 'Cadastrar serviço'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ServiceFormDialog;
