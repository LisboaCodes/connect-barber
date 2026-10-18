import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Input, Label, PageLoader, Section, Select, Switch } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { tenantApi, type PaymentMethodConfig } from '@/lib/api/tenant';
import { PAYMENT_LABEL } from '@/lib/utils/format';

/** Formas configuráveis no caixa (pontos e pacote são automáticos) */
const METHODS = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'ONLINE', 'OTHER'];

const defaultsFor = (method: string): PaymentMethodConfig => ({
  method,
  label: null,
  feePct: 0,
  installmentFees: null,
  maxInstallments: 1,
  isActive: ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD'].includes(method),
});

const toNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function PaymentMethodsSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['tenant', 'payment-methods'], queryFn: tenantApi.paymentMethods });
  const [rows, setRows] = useState<PaymentMethodConfig[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRows(
      METHODS.map((m) => {
        const c = data.find((x) => x.method === m);
        return c ? { ...c, feePct: Number(c.feePct), maxInstallments: Number(c.maxInstallments) || 1 } : defaultsFor(m);
      }),
    );
    setDirty(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () => tenantApi.savePaymentMethods(rows),
    onSuccess: (r) => {
      qc.setQueryData(['tenant', 'payment-methods'], r);
      toast.success('Formas de pagamento salvas');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (i: number, patch: Partial<PaymentMethodConfig>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const invalid = rows.some((r) => r.feePct < 0 || r.feePct > 100 || Object.values(r.installmentFees ?? {}).some((f) => f < 0 || f > 100));

  if (isLoading) return <PageLoader />;

  return (
    <Section title="Formas de pagamento" description="Ative as formas aceitas no caixa e informe as taxas da maquininha para calcular o valor líquido">
      <div className="space-y-3">
        {rows.map((r, i) => {
          const isCredit = r.method === 'CREDIT_CARD';
          return (
            <div key={r.method} className={`rounded-lg border p-3 ${!r.isActive ? 'bg-muted/30' : ''}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Label className="flex w-52 items-center gap-3 font-medium">
                  <Switch checked={r.isActive} onCheckedChange={(c) => set(i, { isActive: c })} />
                  {PAYMENT_LABEL[r.method] ?? r.method}
                </Label>
                <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
                  <Input placeholder="Nome exibido (opcional)" value={r.label ?? ''} disabled={!r.isActive} onChange={(e) => set(i, { label: e.target.value })} />
                  <Input inputMode="decimal" suffix="%" placeholder="Taxa" title="Taxa (%) à vista" defaultValue={String(r.feePct).replace('.', ',')} disabled={!r.isActive} onChange={(e) => set(i, { feePct: toNum(e.target.value) })} />
                  {isCredit && (
                    <Select
                      value={r.maxInstallments}
                      disabled={!r.isActive}
                      onChange={(e) => {
                        const max = Number(e.target.value);
                        const fees = Object.fromEntries(Object.entries(r.installmentFees ?? {}).filter(([k]) => Number(k) <= max));
                        set(i, { maxInstallments: max, installmentFees: fees });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? 'Somente à vista' : `Até ${n}x`}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
              {isCredit && r.isActive && r.maxInstallments > 1 && (
                <div className="mt-3 border-t pt-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Taxa por número de parcelas (%)</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: r.maxInstallments - 1 }, (_, k) => String(k + 2)).map((n) => (
                      <label key={`${n}-${r.maxInstallments}`} className="flex items-center gap-1.5 text-sm">
                        <span className="w-7 text-right text-muted-foreground">{n}x</span>
                        <Input
                          inputMode="decimal"
                          className="h-8"
                          defaultValue={r.installmentFees?.[n] !== undefined ? String(r.installmentFees[n]).replace('.', ',') : ''}
                          placeholder={String(r.feePct).replace('.', ',')}
                          onChange={(e) => {
                            const fees = { ...(r.installmentFees ?? {}) };
                            if (e.target.value.trim() === '') delete fees[n];
                            else fees[n] = toNum(e.target.value);
                            set(i, { installmentFees: fees });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {invalid && <p className="mt-3 text-sm text-red-600">As taxas devem estar entre 0% e 100%.</p>}
      <div className="mt-4 flex justify-end">
        <Button loading={save.isPending} disabled={!dirty || invalid} onClick={() => save.mutate()}>
          Salvar formas de pagamento
        </Button>
      </div>
    </Section>
  );
}

export default PaymentMethodsSettings;
