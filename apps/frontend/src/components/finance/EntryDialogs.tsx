import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, MoneyInput, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { FINANCE_METHODS, financeApi, type FinanceCategory, type FinanceEntry, type FinanceType } from '@/lib/api/finance';
import { money, PAYMENT_LABEL, toISODate } from '@/lib/utils/format';

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['finance'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
};

interface FormState {
  description: string;
  amount: number | '';
  dueDate: string;
  categoryId: string;
  supplier: string;
  notes: string;
  installments: number;
  paid: boolean;
  method: string;
  addToCashier: boolean;
}

const empty = (): FormState => ({ description: '', amount: '', dueDate: toISODate(), categoryId: '', supplier: '', notes: '', installments: 1, paid: false, method: 'PIX', addToCashier: false });

export function EntryDialog({ open, onOpenChange, type, entry, categories }: { open: boolean; onOpenChange: (o: boolean) => void; type: FinanceType; entry?: FinanceEntry | null; categories: FinanceCategory[] }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = !!entry;
  const isExpense = type === 'EXPENSE';

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      entry
        ? { ...empty(), description: entry.description, amount: Number(entry.amount), dueDate: entry.dueDate.slice(0, 10), categoryId: entry.categoryId ?? '', supplier: entry.supplier ?? '', notes: entry.notes ?? '' }
        : empty(),
    );
  }, [open, entry]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const base = { description: f.description.trim(), amount: Number(f.amount), dueDate: f.dueDate, categoryId: f.categoryId || null, supplier: f.supplier || undefined, notes: f.notes || undefined };
      if (isEdit) return financeApi.update(entry!.id, base);
      return financeApi.create({ ...base, type, installments: f.installments > 1 ? f.installments : undefined, paid: f.installments <= 1 ? f.paid : undefined, method: f.paid ? f.method : undefined, addToCashier: f.paid ? f.addToCashier : undefined });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Lançamento atualizado' : f.installments > 1 ? `${f.installments} parcelas criadas` : 'Lançamento criado');
      invalidate(qc);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.description.trim().length < 2) errs.description = 'Informe a descrição';
    if (!f.amount || Number(f.amount) <= 0) errs.amount = 'Informe um valor maior que zero';
    if (!f.dueDate) errs.dueDate = 'Informe o vencimento';
    setErrors(errs);
    if (!Object.keys(errs).length) mut.mutate();
  };

  const cats = categories.filter((c) => c.type === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`${isEdit ? 'Editar' : 'Nova'} ${isExpense ? 'conta a pagar' : 'conta a receber'}`} size="md">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Descrição" required error={errors.description}>
            <Input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={isExpense ? 'Ex.: Aluguel, energia, fornecedor...' : 'Ex.: Aluguel de cadeira, parceria...'} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.installments > 1 ? 'Valor total' : 'Valor'} required error={errors.amount}>
              <MoneyInput value={f.amount} onChange={(v) => set('amount', v)} />
            </Field>
            <Field label={f.installments > 1 ? '1º vencimento' : 'Vencimento'} required error={errors.dueDate}>
              <Input type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </Field>
            <Field label="Categoria">
              <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Sem categoria</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={isExpense ? 'Fornecedor' : 'Pagador'}>
              <Input value={f.supplier} onChange={(e) => set('supplier', e.target.value)} />
            </Field>
          </div>
          {!isEdit && (
            <Field label="Parcelas" hint={f.installments > 1 && f.amount ? `${f.installments}x de ${money(Number(f.amount) / f.installments)} (mensais)` : 'Gera lançamentos mensais com o valor dividido'}>
              <Select value={f.installments} onChange={(e) => set('installments', Number(e.target.value))} className="sm:w-40">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista' : `${n}x`}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Observações">
            <Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          {!isEdit && f.installments <= 1 && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={f.paid} onCheckedChange={(v) => set('paid', !!v)} /> Já {isExpense ? 'paga' : 'recebida'}
              </label>
              {f.paid && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Forma">
                    <Select value={f.method} onChange={(e) => set('method', e.target.value)}>
                      {FINANCE_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_LABEL[m]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <Checkbox checked={f.addToCashier} onCheckedChange={(v) => set('addToCashier', !!v)} /> Lançar no caixa aberto
                  </label>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

export function PayDialog({ entry, onOpenChange }: { entry: FinanceEntry | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number | ''>('');
  const [paidAt, setPaidAt] = useState(toISODate());
  const [method, setMethod] = useState('PIX');
  const [addToCashier, setAddToCashier] = useState(false);

  useEffect(() => {
    if (entry) {
      setAmount(Number(entry.amount));
      setPaidAt(toISODate());
      setMethod('PIX');
      setAddToCashier(false);
    }
  }, [entry]);

  const mut = useMutation({
    mutationFn: () => financeApi.pay(entry!.id, { paidAmount: Number(amount) || undefined, paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : undefined, method, addToCashier }),
    onSuccess: () => {
      toast.success(entry?.type === 'EXPENSE' ? 'Pagamento registrado' : 'Recebimento registrado');
      invalidate(qc);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const isExpense = entry?.type === 'EXPENSE';
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title={isExpense ? 'Registrar pagamento' : 'Registrar recebimento'} description={entry ? `${entry.description} · ${money(entry.amount)}` : undefined}>
        <div className="space-y-4">
          <Field label={isExpense ? 'Valor pago' : 'Valor recebido'}>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Data">
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label="Forma">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {FINANCE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="pay-cashier" checked={addToCashier} onCheckedChange={(v) => setAddToCashier(!!v)} />
            <Label htmlFor="pay-cashier" className="font-normal">
              Lançar no caixa aberto
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="success" loading={mut.isPending} onClick={() => mut.mutate()}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
