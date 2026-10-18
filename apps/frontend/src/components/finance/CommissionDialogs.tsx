import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, MoneyInput, PageLoader, Select, Table, TBody, TD, TH, THead, TR, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { commissionsApi, type PayoutInput, type PayoutPreview, type ProfessionalLite } from '@/lib/api/commissions';
import { FINANCE_METHODS } from '@/lib/api/finance';
import { fmtDate, money, num, PAYMENT_LABEL, toISODate } from '@/lib/utils/format';

const d10 = (s: string) => fmtDate(s.slice(0, 10) + 'T12:00:00');

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['commissions'] });
    qc.invalidateQueries({ queryKey: ['finance'] });
  };
}

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {FINANCE_METHODS.map((m) => (
        <option key={m} value={m}>
          {PAYMENT_LABEL[m]}
        </option>
      ))}
    </Select>
  );
}

// ---------------- Vale ----------------
export function AdvanceDialog({ open, onOpenChange, professionals, defaultProfessionalId }: { open: boolean; onOpenChange: (o: boolean) => void; professionals: ProfessionalLite[]; defaultProfessionalId?: string }) {
  const invalidate = useInvalidate();
  const [professionalId, setProfessionalId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(toISODate());
  const [description, setDescription] = useState('');
  const [addToCashier, setAddToCashier] = useState(true);

  useEffect(() => {
    if (open) {
      setProfessionalId(defaultProfessionalId ?? professionals[0]?.id ?? '');
      setAmount('');
      setDate(toISODate());
      setDescription('');
      setAddToCashier(true);
    }
  }, [open, defaultProfessionalId, professionals]);

  const mut = useMutation({
    mutationFn: () => commissionsApi.createAdvance({ professionalId, amount: Number(amount), date, description: description || undefined, addToCashier }),
    onSuccess: () => {
      toast.success('Vale registrado');
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Novo vale" description="Adiantamento descontado no próximo fechamento de comissão.">
        <div className="space-y-4">
          <Field label="Profissional" required>
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" required>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Descrição">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={addToCashier} onCheckedChange={(v) => setAddToCashier(!!v)} /> Lançar saída no caixa aberto (dinheiro)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={mut.isPending} disabled={!professionalId || !amount || Number(amount) <= 0} onClick={() => mut.mutate()}>
            Registrar vale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Novo fechamento ----------------
export function PayoutDialog({ open, onOpenChange, professionals, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; professionals: ProfessionalLite[]; defaults?: { professionalId?: string; periodStart: string; periodEnd: string } }) {
  const invalidate = useInvalidate();
  const [input, setInput] = useState<PayoutInput>({ professionalId: '', periodStart: toISODate(), periodEnd: toISODate(), deductAdvances: true, deductConsumption: true });
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState('PIX');
  const [addToCashier, setAddToCashier] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setInput({ professionalId: defaults?.professionalId ?? professionals[0]?.id ?? '', periodStart: defaults?.periodStart ?? toISODate(), periodEnd: defaults?.periodEnd ?? toISODate(), deductAdvances: true, deductConsumption: true });
      setPreview(null);
      setPaid(true);
      setMethod('PIX');
      setAddToCashier(false);
      setNotes('');
    }
  }, [open, defaults, professionals]);

  const set = (patch: Partial<PayoutInput>) => {
    setInput((s) => ({ ...s, ...patch }));
    setPreview(null);
  };

  const previewMut = useMutation({ mutationFn: () => commissionsApi.preview(input), onSuccess: setPreview, onError: (e) => toast.error(errorMessage(e)) });
  const createMut = useMutation({
    mutationFn: () => commissionsApi.createPayout({ ...input, paid, method: paid ? method : undefined, addToCashier: paid ? addToCashier : undefined, notes: notes || undefined }),
    onSuccess: () => {
      toast.success(paid ? 'Fechamento criado e pago' : 'Fechamento criado');
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Fechar comissão" description="Gere a prévia, confira os valores e confirme o fechamento.">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Profissional">
              <Select value={input.professionalId} onChange={(e) => set({ professionalId: e.target.value })}>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De">
              <Input type="date" value={input.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
            </Field>
            <Field label="Até">
              <Input type="date" value={input.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={input.deductAdvances !== false} onCheckedChange={(v) => set({ deductAdvances: !!v })} /> Descontar vales em aberto
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={input.deductConsumption !== false} onCheckedChange={(v) => set({ deductConsumption: !!v })} /> Descontar consumo do profissional
            </label>
          </div>
          {!preview ? (
            <Button variant="outline" className="w-full" loading={previewMut.isPending} disabled={!input.professionalId || input.periodStart > input.periodEnd} onClick={() => previewMut.mutate()}>
              Gerar prévia
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Box label="Comissões" value={money(preview.commissionsTotal)} hint={`${preview.entries.length} item(ns)`} />
                <Box label="Vales" value={money(-preview.advancesTotal)} hint={`${preview.advances.length} vale(s)`} negative />
                <Box label="Consumo" value={money(-preview.consumptionTotal)} hint={`${preview.consumption.length} comanda(s)`} negative />
                <Box label="Líquido a pagar" value={money(preview.netAmount)} strong />
              </div>
              {preview.entries.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border scrollbar-thin">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Data</TH>
                        <TH>Item</TH>
                        <TH className="text-right">Base</TH>
                        <TH className="text-right">%</TH>
                        <TH className="text-right">Comissão</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {preview.entries.map((e) => (
                        <TR key={e.id}>
                          <TD className="whitespace-nowrap">{d10(e.referenceDate)}</TD>
                          <TD>
                            {e.orderItem?.description}
                            {e.order && <span className="text-xs text-muted-foreground"> · #{e.order.number}</span>}
                          </TD>
                          <TD className="text-right tabular-nums">{money(e.baseAmount)}</TD>
                          <TD className="text-right tabular-nums">{num(e.pct, 0)}%</TD>
                          <TD className="text-right font-medium tabular-nums">{money(e.amount)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
              {preview.entries.length === 0 && preview.advances.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Nenhuma comissão pendente neste período.</p>}
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={paid} onCheckedChange={(v) => setPaid(!!v)} /> Já marcar como pago
                </label>
                {paid && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Forma de pagamento">
                      <MethodSelect value={method} onChange={setMethod} />
                    </Field>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                      <Checkbox checked={addToCashier} onCheckedChange={(v) => setAddToCashier(!!v)} /> Lançar saída no caixa aberto
                    </label>
                  </div>
                )}
                <Field label="Observações">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
                </Field>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {preview && (
            <Button loading={createMut.isPending} disabled={preview.entries.length === 0 && preview.advances.length === 0} onClick={() => createMut.mutate()}>
              Confirmar fechamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Box({ label, value, hint, negative, strong }: { label: string; value: string; hint?: string; negative?: boolean; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? 'border-primary/40 bg-accent' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${negative ? 'text-red-600' : ''}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ---------------- Detalhe do fechamento ----------------
export function PayoutDetailDialog({ id, onOpenChange, canManage }: { id: string | null; onOpenChange: (o: boolean) => void; canManage: boolean }) {
  const invalidate = useInvalidate();
  const [method, setMethod] = useState('PIX');
  const [addToCashier, setAddToCashier] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['commissions', 'payout', id], queryFn: () => commissionsApi.payout(id!), enabled: !!id });

  const pay = useMutation({
    mutationFn: () => commissionsApi.payPayout(id!, { method, addToCashier }),
    onSuccess: () => {
      toast.success('Fechamento pago');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Fechamento de comissão" description={data ? `${data.professional.name} · ${d10(data.periodStart)} a ${d10(data.periodEnd)}` : undefined}>
        {isLoading || !data ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box label="Comissões" value={money(data.commissionsTotal)} />
              <Box label="Vales" value={money(-data.advancesTotal)} negative />
              <Box label="Consumo" value={money(-data.consumptionTotal)} negative />
              <Box label="Líquido" value={money(data.netAmount)} strong />
            </div>
            <div className="flex items-center gap-2 text-sm">
              Status: {data.paidAt ? <Badge variant="success">Pago em {fmtDate(data.paidAt)}{data.method ? ` · ${PAYMENT_LABEL[data.method] ?? data.method}` : ''}</Badge> : <Badge variant="warning">Aguardando pagamento</Badge>}
            </div>
            {data.notes && <p className="rounded-lg bg-muted p-3 text-sm">{data.notes}</p>}
            {data.entries.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border scrollbar-thin">
                <Table>
                  <THead>
                    <TR>
                      <TH>Data</TH>
                      <TH>Item</TH>
                      <TH className="text-right">Base</TH>
                      <TH className="text-right">Comissão</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.entries.map((e) => (
                      <TR key={e.id}>
                        <TD className="whitespace-nowrap">{d10(e.referenceDate)}</TD>
                        <TD>
                          {e.orderItem?.description}
                          {e.order && <span className="text-xs text-muted-foreground"> · #{e.order.number}</span>}
                        </TD>
                        <TD className="text-right tabular-nums">{money(e.baseAmount)}</TD>
                        <TD className="text-right font-medium tabular-nums">{money(e.amount)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            {data.advances.length > 0 && (
              <div className="text-sm">
                <div className="mb-1 font-medium">Vales descontados</div>
                <ul className="space-y-1 text-muted-foreground">
                  {data.advances.map((a) => (
                    <li key={a.id} className="flex justify-between">
                      <span>
                        {d10(a.date)} {a.description ? `· ${a.description}` : ''}
                      </span>
                      <span className="tabular-nums">{money(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!data.paidAt && canManage && (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="w-48 space-y-1">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <MethodSelect value={method} onChange={setMethod} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <Checkbox checked={addToCashier} onCheckedChange={(v) => setAddToCashier(!!v)} /> Lançar no caixa aberto
                </label>
                <Button variant="success" className="ml-auto" loading={pay.isPending} onClick={() => pay.mutate()}>
                  Marcar como pago
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
