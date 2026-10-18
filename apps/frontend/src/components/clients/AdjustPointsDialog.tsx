import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { clientsApi } from '@/lib/api/clients';
import { num } from '@/lib/utils/format';

const schema = z.object({
  op: z.enum(['add', 'remove']),
  points: z.coerce.number().int('Use números inteiros').min(1, 'Informe a quantidade'),
  description: z.string().max(200),
});
type FormValues = z.infer<typeof schema>;

export function AdjustPointsDialog({ open, onOpenChange, clientId, balance }: { open: boolean; onOpenChange: (o: boolean) => void; clientId: string; balance: number }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { op: 'add', points: 0, description: '' } });

  useEffect(() => {
    if (open) reset({ op: 'add', points: 0, description: '' });
  }, [open, reset]);

  const mut = useMutation({
    mutationFn: (v: FormValues) => clientsApi.adjustPoints(clientId, v.op === 'add' ? v.points : -v.points, v.description || undefined),
    onSuccess: () => {
      toast.success('Pontos ajustados');
      qc.invalidateQueries({ queryKey: ['client', clientId] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const op = watch('op');
  const pts = Number(watch('points')) || 0;
  const after = op === 'add' ? balance + pts : balance - pts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Ajustar pontos" description={`Saldo atual: ${num(balance)} pontos`}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Operação">
              <Select {...register('op')}>
                <option value="add">Adicionar</option>
                <option value="remove">Remover</option>
              </Select>
            </Field>
            <Field label="Pontos" error={formState.errors.points?.message}>
              <Input type="number" min={1} step={1} {...register('points')} />
            </Field>
          </div>
          <Field label="Motivo" hint="Aparece no extrato do cliente">
            <Input {...register('description')} placeholder="Ex.: bônus de indicação" />
          </Field>
          <p className={`text-sm ${after < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>Saldo após o ajuste: {num(after)} pontos</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending} disabled={after < 0}>
              Confirmar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AdjustPointsDialog;
