import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Label, MoneyInput, Select, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { dateOnly } from '@/lib/api/clients';
import { productsApi, type Product, type ProductCategory, type ProductInput } from '@/lib/api/products';
import { money } from '@/lib/utils/format';

const decimalStr = (max?: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= 0 && (max === undefined || Number(v.replace(',', '.')) <= max)), max ? `Entre 0 e ${max}` : 'Valor inválido');
const toNum = (v: string) => (v === '' ? undefined : Number(v.replace(',', '.')));

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(100),
  categoryId: z.string(),
  brand: z.string(),
  sku: z.string(),
  barcode: z.string(),
  unit: z.string().min(1),
  costPrice: z.number().min(0),
  salePrice: z.number({ invalid_type_error: 'Informe o preço' }).min(0),
  stock: decimalStr(),
  minStock: decimalStr(),
  expiresAt: z.string(),
  commissionPct: decimalStr(100),
  loyaltyPoints: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), 'Número inteiro'),
  forSale: z.boolean(),
  forInternalUse: z.boolean(),
  isActive: z.boolean(),
  description: z.string().max(1000),
});
type FormValues = z.infer<typeof schema>;

const toForm = (p?: Product | null): FormValues => ({
  name: p?.name ?? '',
  categoryId: p?.categoryId ?? '',
  brand: p?.brand ?? '',
  sku: p?.sku ?? '',
  barcode: p?.barcode ?? '',
  unit: p?.unit ?? 'un',
  costPrice: Number(p?.costPrice ?? 0),
  salePrice: Number(p?.salePrice ?? 0),
  stock: p ? String(Number(p.stock)) : '',
  minStock: p ? String(Number(p.minStock)) : '',
  expiresAt: dateOnly(p?.expiresAt),
  commissionPct: p?.commissionPct === null || p?.commissionPct === undefined ? '' : String(Number(p.commissionPct)),
  loyaltyPoints: p?.loyaltyPoints === null || p?.loyaltyPoints === undefined ? '' : String(p.loyaltyPoints),
  forSale: p?.forSale ?? true,
  forInternalUse: p?.forInternalUse ?? false,
  isActive: p?.isActive ?? true,
  description: p?.description ?? '',
});

export function ProductFormDialog({ open, onOpenChange, product, categories }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; categories: ProductCategory[] }) {
  const qc = useQueryClient();
  const editing = !!product;
  const { register, handleSubmit, reset, control, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(product) });

  useEffect(() => {
    if (open) reset(toForm(product));
  }, [open, product, reset]);

  const mut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: ProductInput = {
        name: v.name,
        categoryId: v.categoryId || null,
        brand: v.brand || undefined,
        sku: v.sku || undefined,
        barcode: v.barcode || undefined,
        unit: v.unit,
        costPrice: v.costPrice,
        salePrice: v.salePrice,
        minStock: toNum(v.minStock) ?? 0,
        expiresAt: v.expiresAt || null,
        commissionPct: v.commissionPct === '' ? null : toNum(v.commissionPct),
        loyaltyPoints: v.loyaltyPoints === '' ? null : Number(v.loyaltyPoints),
        forSale: v.forSale,
        forInternalUse: v.forInternalUse,
        isActive: v.isActive,
        description: v.description || undefined,
        ...(editing ? {} : { stock: toNum(v.stock) ?? 0 }),
      };
      return editing ? productsApi.update(product!.id, payload) : productsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Produto atualizado' : 'Produto cadastrado');
      qc.invalidateQueries({ queryKey: ['products'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cost = watch('costPrice');
  const sale = watch('salePrice');
  const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={editing ? 'Editar produto' : 'Novo produto'}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nome" required error={formState.errors.name?.message} className="sm:col-span-4">
              <Input autoFocus {...register('name')} placeholder="Pomada modeladora" />
            </Field>
            <Field label="Unidade" className="sm:col-span-2">
              <Select {...register('unit')}>
                <option value="un">Unidade (un)</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="g">Grama (g)</option>
                <option value="cx">Caixa (cx)</option>
                <option value="pct">Pacote (pct)</option>
              </Select>
            </Field>
            <Field label="Categoria" className="sm:col-span-2">
              <Select {...register('categoryId')}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Marca" className="sm:col-span-2">
              <Input {...register('brand')} />
            </Field>
            <Field label="Código / SKU" className="sm:col-span-2">
              <Input {...register('sku')} />
            </Field>
            <Field label="Preço de custo" className="sm:col-span-2">
              <Controller control={control} name="costPrice" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Preço de venda" required error={formState.errors.salePrice?.message} className="sm:col-span-2" hint={sale > 0 ? `Margem ${margin.toFixed(1)}% · lucro ${money(sale - cost)}` : undefined}>
              <Controller control={control} name="salePrice" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Comissão" hint="Vazio = a do profissional" error={formState.errors.commissionPct?.message} className="sm:col-span-2">
              <Input inputMode="decimal" suffix="%" {...register('commissionPct')} />
            </Field>
            {!editing ? (
              <Field label="Estoque inicial" error={formState.errors.stock?.message} className="sm:col-span-2">
                <Input inputMode="decimal" {...register('stock')} placeholder="0" />
              </Field>
            ) : (
              <Field label="Estoque atual" hint="Altere pelas movimentações" className="sm:col-span-2">
                <Input disabled value={`${Number(product!.stock)} ${product!.unit}`} />
              </Field>
            )}
            <Field label="Estoque mínimo" hint="Alerta de reposição" error={formState.errors.minStock?.message} className="sm:col-span-2">
              <Input inputMode="decimal" {...register('minStock')} placeholder="0" />
            </Field>
            <Field label="Validade" className="sm:col-span-2">
              <Input type="date" {...register('expiresAt')} />
            </Field>
            <Field label="Código de barras" className="sm:col-span-3">
              <Input {...register('barcode')} />
            </Field>
            <Field label="Pontos de fidelidade" error={formState.errors.loyaltyPoints?.message} hint="Vazio = regra padrão" className="sm:col-span-3">
              <Input type="number" min={0} {...register('loyaltyPoints')} />
            </Field>
            <Field label="Descrição" className="sm:col-span-6">
              <Textarea rows={2} {...register('description')} />
            </Field>
          </div>
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            {(
              [
                ['forSale', 'Vende ao cliente'],
                ['forInternalUse', 'Uso interno'],
                ['isActive', 'Ativo'],
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              {editing ? 'Salvar' : 'Cadastrar produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProductFormDialog;
