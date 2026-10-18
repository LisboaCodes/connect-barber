import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui';
import { cashierApi, MOVEMENT_LABEL, type CashMovementType, type CashierSummary } from '@/lib/api/cashier';
import { errorMessage } from '@/lib/api/client';
import { money, PAYMENT_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type ManualType = Exclude<CashMovementType, 'SALE'>;
const TYPES: { value: ManualType; hint: string }[] = [
  { value: 'INCOME', hint: 'Outra entrada de dinheiro' },
  { value: 'EXPENSE', hint: 'Pagamento de despesa com dinheiro do caixa' },
  { value: 'WITHDRAWAL', hint: 'Retirada de dinheiro da gaveta' },
  { value: 'SUPPLY', hint: 'Reforço de troco na gaveta' },
];
const METHODS = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER'];

export function MovementDialog({ open, onOpenChange, defaultType = 'INCOME' }: { open: boolean; onOpenChange: (o: boolean) => void; defaultType?: ManualType }) {
  const qc = useQueryClient();
  const [type, setType] = useState<ManualType>(defaultType);
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState('CASH');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setAmount('');
    setMethod('CASH');
    setDescription('');
  }, [open, defaultType]);

  const save = useMutation({
    mutationFn: () => cashierApi.addMovement({ type, amount: Number(amount), method, description: description || undefined }),
    onSuccess: () => {
      toast.success(`${MOVEMENT_LABEL[type]} registrada`);
      qc.invalidateQueries({ queryKey: ['cashier'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Nova movimentação">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn('rounded-lg border p-2 text-left text-sm transition-colors', type === t.value ? 'border-primary bg-amber-50' : 'hover:bg-accent')}
            >
              <div className="font-medium">{MOVEMENT_LABEL[t.value]}</div>
              <div className="text-[11px] text-muted-foreground">{t.hint}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" required>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Forma">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Descrição">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Ex.: compra de café" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!(Number(amount) > 0)} loading={save.isPending}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloseCashierDialog({ open, onOpenChange, summary }: { open: boolean; onOpenChange: (o: boolean) => void; summary: CashierSummary }) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setCounted(summary.expectedCash);
    setNotes('');
  }, [open, summary.expectedCash]);

  const diff = Math.round(((Number(counted) || 0) - summary.expectedCash) * 100) / 100;

  const close = useMutation({
    mutationFn: () => cashierApi.close({ closingBalance: Number(counted) || 0, notes: notes || undefined }),
    onSuccess: (s) => {
      const d = Number(s.difference ?? 0);
      if (Math.abs(d) < 0.01) toast.success('Caixa fechado sem diferença');
      else toast.warning(`Caixa fechado com ${d > 0 ? 'sobra' : 'falta'} de ${money(Math.abs(d))}`);
      qc.invalidateQueries({ queryKey: ['cashier'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Fechar caixa" description="Conte o dinheiro da gaveta e informe o valor.">
        <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span>Saldo inicial</span>
            <span>{money(summary.openingBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span>Vendas + entradas</span>
            <span>{money(summary.sales + summary.income)}</span>
          </div>
          <div className="flex justify-between">
            <span>Saídas</span>
            <span className="text-red-600">-{money(summary.expense + summary.withdrawal)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Esperado em dinheiro</span>
            <span>{money(summary.expectedCash)}</span>
          </div>
        </div>
        <Field label="Dinheiro contado na gaveta" required>
          <MoneyInput value={counted} onChange={setCounted} autoFocus />
        </Field>
        <div className={cn('flex items-center justify-between rounded-lg border p-3 text-sm font-semibold', Math.abs(diff) < 0.01 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : diff > 0 ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-red-200 bg-red-50 text-red-800')}>
          <span>{Math.abs(diff) < 0.01 ? 'Sem diferença' : diff > 0 ? 'Sobra' : 'Falta'}</span>
          <span>{money(Math.abs(diff))}</span>
        </div>
        <Field label="Observações">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={() => close.mutate()} disabled={counted === ''} loading={close.isPending}>
            Fechar caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
