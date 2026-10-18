import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, MoneyInput, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { productsApi, type MovementInput, type Product } from '@/lib/api/products';

const TYPES: { value: MovementInput['type']; label: string; hint: string }[] = [
  { value: 'IN', label: 'Entrada (compra/reposição)', hint: 'Soma ao estoque' },
  { value: 'OUT', label: 'Saída manual', hint: 'Subtrai do estoque' },
  { value: 'USE', label: 'Uso interno', hint: 'Consumo nos atendimentos' },
  { value: 'LOSS', label: 'Perda / avaria / vencido', hint: 'Subtrai do estoque' },
  { value: 'ADJUST', label: 'Ajuste de saldo (inventário)', hint: 'Define o novo saldo' },
];

const schema = z.object({
  productId: z.string().min(1, 'Selecione o produto'),
  type: z.enum(['IN', 'OUT', 'USE', 'LOSS', 'ADJUST']),
  quantity: z
    .string()
    .trim()
    .refine((v) => v !== '' && !Number.isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= 0, 'Quantidade inválida'),
  unitCost: z.number().min(0),
  updateCost: z.boolean(),
  reason: z.string().max(300),
});
type FormValues = z.infer<typeof schema>;

export function StockMovementDialog({ open, onOpenChange, product, defaultType = 'IN' }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; defaultType?: MovementInput['type'] }) {
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ['products', 'picker'], queryFn: () => productsApi.list({ limit: 200 }), enabled: open && !product });
  const { register, handleSubmit, reset, control, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { productId: product?.id ?? '', type: defaultType, quantity: '', unitCost: Number(product?.costPrice ?? 0), updateCost: false, reason: '' },
  });

  useEffect(() => {
    if (open) reset({ productId: product?.id ?? '', type: defaultType, quantity: '', unitCost: Number(product?.costPrice ?? 0), updateCost: false, reason: '' });
  }, [open, product, defaultType, reset]);

  const type = watch('type');
  const productId = watch('productId');
  const selected = product ?? products?.items.find((p) => p.id === productId);
  const qty = Number((watch('quantity') || '0').replace(',', '.')) || 0;
  const current = Number(selected?.stock ?? 0);
  const after = type === 'ADJUST' ? qty : type === 'IN' ? current + qty : current - qty;

  const mut = useMutation({
    mutationFn: (v: FormValues) =>
      productsApi.move(v.productId, {
        type: v.type,
        quantity: Number(v.quantity.replace(',', '.')),
        unitCost: v.type === 'IN' ? v.unitCost : undefined,
        updateCost: v.type === 'IN' ? v.updateCost : undefined,
        reason: v.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Movimentação registrada');
      qc.invalidateQueries({ queryKey: ['products'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Movimentar estoque" description={product ? `${product.name} · saldo atual ${current} ${product.unit}` : undefined}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          {!product && (
            <Field label="Produto" required error={formState.errors.productId?.message}>
              <Select {...register('productId')}>
                <option value="">Selecione...</option>
                {products?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (saldo {Number(p.stock)} {p.unit})
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Tipo" hint={TYPES.find((t) => t.value === type)?.hint}>
            <Select {...register('type')}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === 'ADJUST' ? 'Novo saldo' : 'Quantidade'} required error={formState.errors.quantity?.message}>
              <Input inputMode="decimal" autoFocus {...register('quantity')} suffix={selected?.unit} />
            </Field>
            {type === 'IN' && (
              <Field label="Custo unitário">
                <Controller control={control} name="unitCost" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
              </Field>
            )}
          </div>
          {type === 'IN' && (
            <Controller
              control={control}
              name="updateCost"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /> Atualizar o preço de custo do produto com este valor
                </Label>
              )}
            />
          )}
          <Field label="Motivo / observação">
            <Input {...register('reason')} placeholder={type === 'IN' ? 'NF 1234 - Fornecedor X' : 'Ex.: produto danificado'} />
          </Field>
          {selected && (
            <p className={`text-sm ${after < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              Saldo: {current} → <span className="font-semibold">{Number(after.toFixed(3))}</span> {selected.unit}
              {after < 0 && ' (estoque insuficiente)'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending} disabled={after < 0}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StockMovementDialog;
