import { OnlineChargeButtons } from './OnlineChargeDialog';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, MoneyInput, Select } from '@/components/ui';
import { ordersApi, type Order, type PaymentMethodConfig } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { fmtTime, money, PAYMENT_LABEL } from '@/lib/utils/format';

const DEFAULT_METHODS = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER'];

export function feeFor(cfg: PaymentMethodConfig | undefined, installments: number) {
  if (!cfg) return 0;
  const byInst = cfg.installmentFees?.[String(installments)];
  return Number(byInst ?? cfg.feePct ?? 0);
}

export function PaymentPanel({ order, onDone, editable }: { order: Order; onDone: (o: Order) => void; editable: boolean }) {
  const methodsQ = useQuery({ queryKey: ['payment-methods'], queryFn: ordersApi.paymentMethods, staleTime: 300_000 });
  const configs = methodsQ.data ?? [];
  const methods = useMemo(() => {
    const active = configs.filter((c) => c.isActive && c.method !== 'PACKAGE' && c.method !== 'ONLINE').map((c) => c.method);
    const list = active.length ? active : DEFAULT_METHODS;
    if ((order.client?.loyaltyPoints ?? 0) > 0 && !list.includes('LOYALTY_POINTS')) return [...list, 'LOYALTY_POINTS'];
    return list.filter((m) => m !== 'LOYALTY_POINTS' || (order.client?.loyaltyPoints ?? 0) > 0);
  }, [configs, order.client?.loyaltyPoints]);

  const remaining = Math.max(0, Math.round((Number(order.total) - Number(order.paidTotal)) * 100) / 100);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState<number | ''>(remaining);
  const [installments, setInstallments] = useState(1);
  const [points, setPoints] = useState<number | ''>('');

  useEffect(() => {
    if (!method && methods.length) setMethod(methods[0]);
  }, [methods, method]);
  useEffect(() => {
    setAmount(remaining || '');
  }, [remaining]);
  useEffect(() => {
    setInstallments(1);
    setPoints('');
  }, [method]);

  const cfg = configs.find((c) => c.method === method);
  const maxInst = method === 'CREDIT_CARD' ? Math.max(1, cfg?.maxInstallments ?? 12) : 1;
  const fee = feeFor(cfg, installments);
  const feeAmount = Math.round((Number(amount) || 0) * fee) / 100;

  const add = useMutation({
    mutationFn: () =>
      ordersApi.addPayment(order.id, {
        method,
        amount: Number(amount),
        installments: maxInst > 1 ? installments : undefined,
        points: method === 'LOYALTY_POINTS' && points !== '' ? Math.round(Number(points)) : undefined,
      }),
    onSuccess: (o) => {
      toast.success('Pagamento lançado');
      onDone(o);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (paymentId: string) => ordersApi.removePayment(order.id, paymentId),
    onSuccess: (o) => {
      toast.success('Pagamento removido');
      onDone(o);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      {order.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento lançado.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">
                  {configs.find((c) => c.method === p.method)?.label || PAYMENT_LABEL[p.method] || p.method}
                  {p.installments > 1 && <span className="ml-1 text-xs text-muted-foreground">({p.installments}x)</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtTime(p.createdAt)}
                  {Number(p.feeAmount) > 0 && ` · taxa ${Number(p.feePct)}% (${money(p.feeAmount)}) · líquido ${money(p.netAmount)}`}
                </div>
              </div>
              <span className="font-semibold">{money(p.amount)}</span>
              {editable && (
                <Button variant="ghost" size="icon-sm" className="print:hidden" onClick={() => remove.mutate(p.id)} disabled={remove.isPending} title="Remover pagamento">
                  <Trash2 className="text-red-600" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && remaining > 0 && <OnlineChargeButtons order={order} onDone={onDone} remaining={remaining} />}

      {editable && remaining > 0 && (
        <form
          className="space-y-3 rounded-lg border border-dashed p-3 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            if (method && Number(amount) > 0) add.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma de pagamento" className="col-span-2 sm:col-span-1">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {configs.find((c) => c.method === m)?.label || PAYMENT_LABEL[m] || m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor" className="col-span-2 sm:col-span-1">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            {maxInst > 1 && (
              <Field label="Parcelas">
                <Select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                  {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {feeFor(cfg, n) ? `(taxa ${feeFor(cfg, n)}%)` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {method === 'LOYALTY_POINTS' && (
              <Field label="Pontos a resgatar" hint={`Saldo: ${order.client?.loyaltyPoints ?? 0} pts · vazio = conversão automática`}>
                <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{fee > 0 ? `Taxa estimada ${fee}%: ${money(feeAmount)}` : 'Sem taxa'}</span>
            <div className="flex gap-2">
              {Number(amount) !== remaining && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAmount(remaining)}>
                  Restante ({money(remaining)})
                </Button>
              )}
              <Button type="submit" size="sm" loading={add.isPending} disabled={!method || !(Number(amount) > 0)}>
                <Plus /> Lançar pagamento
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default PaymentPanel;
