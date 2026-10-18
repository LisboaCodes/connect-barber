import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Crown, MessageCircle, Pencil, Plus, Printer, Receipt, RotateCcw, Star, Trash2, UserCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  Field,
  MoneyInput,
  PageLoader,
  Section,
  Select,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from '@/components/ui';
import { ordersApi, type Order, type OrderItem } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { fmtDateTime, fmtPhone, money, num, STATUS_COLOR, STATUS_LABEL, toISODate, whatsappLink } from '@/lib/utils/format';
import { useIsStaff } from '@/store/auth.store';
import { cn } from '@/lib/utils/cn';
import { AddItemDialog, EditItemDialog } from '@/components/orders/ItemDialogs';
import { PaymentPanel } from '@/components/orders/PaymentPanel';

const TYPE_LABEL: Record<string, string> = { SERVICE: 'Serviço', PRODUCT: 'Produto', PACKAGE: 'Pacote', CUSTOM: 'Avulso' };

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isStaff = useIsStaff();

  const q = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id), enabled: !!id });
  const order = q.data;

  const setOrder = (o: Order) => {
    qc.setQueryData(['order', id], o);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['orders-summary'] });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<OrderItem | null>(null);
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [cashierError, setCashierError] = useState(false);

  // desconto / observações
  const [discountType, setDiscountType] = useState<'' | 'PERCENT' | 'AMOUNT'>('');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [addToCashier, setAddToCashier] = useState(true);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!order) return;
    setDiscountType(order.discountType ?? '');
    setDiscountValue(order.discountType ? Number(order.discountValue) : '');
    setAddToCashier(order.addToCashier);
    setNotes(order.notes ?? '');
  }, [order?.id, order?.discountType, order?.discountValue, order?.addToCashier, order?.notes]);

  const onErr = (e: unknown) => {
    const msg = errorMessage(e);
    if (/caixa/i.test(msg)) {
      setCashierError(true);
      toast.error(msg, { action: { label: 'Abrir caixa', onClick: () => navigate('/app/caixa') } });
    } else toast.error(msg);
  };

  const removeItem = useMutation({
    mutationFn: (itemId: string) => ordersApi.removeItem(id, itemId),
    onSuccess: (o) => {
      setOrder(o);
      setRemoveItemId(null);
      toast.success('Item removido');
    },
    onError: onErr,
  });

  const saveDiscount = useMutation({
    mutationFn: () =>
      ordersApi.update(id, {
        discountType: discountType || null,
        discountValue: discountType ? Number(discountValue) || 0 : 0,
        addToCashier,
        notes,
      }),
    onSuccess: (o) => {
      setOrder(o);
      toast.success('Comanda atualizada');
    },
    onError: onErr,
  });

  const close = useMutation({
    mutationFn: (allowPartial: boolean) => ordersApi.close(id, { allowPartial: allowPartial || undefined }),
    onSuccess: (o) => {
      setOrder(o);
      setCloseOpen(false);
      setCashierError(false);
      qc.invalidateQueries({ queryKey: ['cashier'] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
      toast.success(`Comanda #${o.number} fechada${o.loyaltyPointsEarned ? ` · +${o.loyaltyPointsEarned} pontos` : ''}`);
    },
    onError: (e) => {
      setCloseOpen(false);
      onErr(e);
    },
  });

  const reopen = useMutation({
    mutationFn: () => ordersApi.reopen(id),
    onSuccess: (o) => {
      setOrder(o);
      setReopenOpen(false);
      qc.invalidateQueries({ queryKey: ['cashier'] });
      toast.success('Comanda reaberta');
    },
    onError: (e) => {
      setReopenOpen(false);
      onErr(e);
    },
  });

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: (o) => {
      setOrder(o);
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ['agenda'] });
      toast.success('Comanda cancelada');
    },
    onError: (e) => {
      setCancelOpen(false);
      onErr(e);
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.isError || !order)
    return (
      <EmptyState
        icon={Receipt}
        title="Comanda não encontrada"
        description={q.isError ? errorMessage(q.error) : undefined}
        action={
          <Button asChild variant="outline">
            <Link to="/app/comandas">Voltar às comandas</Link>
          </Button>
        }
      />
    );

  const isOpen = order.status === 'OPEN';
  const remaining = Math.round((Number(order.total) - Number(order.paidTotal)) * 100) / 100;
  const consumption = order.kind === 'PROFESSIONAL_CONSUMPTION';
  const discountDirty =
    (discountType || null) !== (order.discountType ?? null) ||
    (discountType ? Number(discountValue) || 0 : 0) !== (order.discountType ? Number(order.discountValue) : 0) ||
    addToCashier !== order.addToCashier ||
    notes !== (order.notes ?? '');

  return (
    <div className="space-y-5">
      <style>{`@media print { aside, header { display: none !important; } main { padding: 0 !important; } body { background: #fff !important; } }`}</style>

      {/* cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/app/comandas" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
            <ArrowLeft className="h-4 w-4" /> Comandas
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            Comanda #{order.number}
            <Badge className={cn('border', STATUS_COLOR[order.status])}>{STATUS_LABEL[order.status]}</Badge>
            {consumption && <Badge variant="secondary">Consumo do profissional</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aberta em {fmtDateTime(order.openedAt)}
            {order.closedAt && ` · fechada em ${fmtDateTime(order.closedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
          {isOpen && (
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setCancelOpen(true)}>
              <Ban /> Cancelar
            </Button>
          )}
          {order.status === 'CLOSED' && isStaff && (
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              <RotateCcw /> Reabrir
            </Button>
          )}
          {isOpen && (
            <Button variant="success" onClick={() => setCloseOpen(true)} disabled={order.items.length === 0}>
              <CheckCircle2 /> Fechar comanda
            </Button>
          )}
        </div>
      </div>

      {cashierError && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center print:hidden">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1">O caixa está fechado. Abra o caixa para fechar comandas que entram no caixa — ou desmarque "Inserir no caixa".</span>
          <Button asChild size="sm">
            <Link to="/app/caixa">Ir para o caixa</Link>
          </Button>
        </div>
      )}

      {/* cliente / profissional / agendamento */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <UserCircle2 className="h-4 w-4" /> Cliente
          </div>
          {order.client ? (
            <div className="space-y-1 text-sm">
              <Link to={`/app/clientes/${order.client.id}`} className="font-semibold hover:underline">
                {order.client.name}
              </Link>
              <div className="text-muted-foreground">{fmtPhone(order.client.phone)}</div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="warning" className="gap-1">
                  <Star className="h-3 w-3" /> {num(order.client.loyaltyPoints)} pts
                </Badge>
                {order.client.club && (
                  <Badge variant="secondary" className="gap-1">
                    <Crown className="h-3 w-3" /> {order.client.club.name}
                    {Number(order.client.club.discountPct) > 0 && ` · ${num(order.client.club.discountPct)}%`}
                  </Badge>
                )}
                {order.client.phone && (
                  <a href={whatsappLink(order.client.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline print:hidden">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Venda sem cliente identificado</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Profissional</div>
          {order.professional ? (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: order.professional.color }} />
              {order.professional.name}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Definido por item</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <CalendarClock className="h-4 w-4" /> Agendamento
          </div>
          {order.appointment ? (
            <div className="text-sm">
              <Link to={`/app/agenda?date=${toISODate(new Date(order.appointment.startAt))}`} className="font-semibold hover:underline">
                {fmtDateTime(order.appointment.startAt)}
              </Link>
              <div className="mt-1">
                <Badge className={cn('border', STATUS_COLOR[order.appointment.status])}>{STATUS_LABEL[order.appointment.status]}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem agendamento vinculado</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* itens */}
        <div className="space-y-5 lg:col-span-2">
          <Section
            title="Itens"
            actions={
              isOpen && (
                <Button size="sm" onClick={() => setAddOpen(true)} className="print:hidden">
                  <Plus /> Adicionar item
                </Button>
              )
            }
          >
            {order.items.length === 0 ? (
              <EmptyState title="Nenhum item" description="Adicione serviços, produtos ou pacotes." className="p-6" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH className="hidden sm:table-cell">Profissional</TH>
                    <TH className="text-right">Qtd.</TH>
                    <TH className="hidden text-right sm:table-cell">Unit.</TH>
                    <TH className="hidden text-right md:table-cell">Desc.</TH>
                    <TH className="text-right">Total</TH>
                    {isOpen && <TH className="w-20 print:hidden" />}
                  </TR>
                </THead>
                <TBody>
                  {order.items.map((it) => (
                    <TR key={it.id}>
                      <TD>
                        <div className="font-medium">{it.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {TYPE_LABEL[it.type]}
                          {it.clientPackageItemId && ' · sessão de pacote'}
                          <span className="sm:hidden">{it.professional ? ` · ${it.professional.name}` : ''}</span>
                        </div>
                      </TD>
                      <TD className="hidden sm:table-cell">{it.professional?.name ?? '-'}</TD>
                      <TD className="text-right tabular-nums">{num(it.quantity, Number(it.quantity) % 1 ? 2 : 0)}</TD>
                      <TD className="hidden text-right tabular-nums sm:table-cell">{money(it.unitPrice)}</TD>
                      <TD className="hidden text-right tabular-nums text-red-600 md:table-cell">{Number(it.discountAmount) > 0 ? `-${money(it.discountAmount)}` : '-'}</TD>
                      <TD className="text-right font-semibold tabular-nums">{money(it.total)}</TD>
                      {isOpen && (
                        <TD className="print:hidden">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEditItem(it)} title="Editar">
                              <Pencil />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setRemoveItemId(it.id)} title="Remover">
                              <Trash2 className="text-red-600" />
                            </Button>
                          </div>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Section>

          <Section title="Pagamentos">
            <PaymentPanel order={order} onDone={setOrder} editable={isOpen} />
          </Section>
        </div>

        {/* totais e desconto */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              <Row label={`Desconto${order.discountType === 'PERCENT' ? ` (${num(order.discountValue, 2)}%)` : ''}`} value={Number(order.discountAmount) > 0 ? `-${money(order.discountAmount)}` : money(0)} className="text-red-600" />
              <div className="border-t pt-2">
                <Row label="Total" value={money(order.total)} className="text-lg font-bold" />
              </div>
              <Row label="Pago" value={money(order.paidTotal)} className="text-emerald-700" />
              <Row label={remaining >= 0 ? 'Restante' : 'Troco'} value={money(Math.abs(remaining))} className={cn('font-semibold', remaining > 0 ? 'text-amber-700' : 'text-muted-foreground')} />
              {Number(order.feesTotal) > 0 && <Row label="Taxas de pagamento" value={money(order.feesTotal)} className="text-xs text-muted-foreground" />}
              {order.loyaltyPointsEarned > 0 && <Row label="Pontos ganhos" value={`+${order.loyaltyPointsEarned}`} className="text-xs text-amber-700" />}
              {order.loyaltyPointsRedeemed > 0 && <Row label="Pontos resgatados" value={`-${order.loyaltyPointsRedeemed}`} className="text-xs text-muted-foreground" />}
            </div>
            {isOpen && (
              <Button variant="success" className="mt-4 w-full print:hidden" onClick={() => setCloseOpen(true)} disabled={order.items.length === 0}>
                <CheckCircle2 /> Fechar comanda
              </Button>
            )}
          </Card>

          <Section title="Desconto e opções" className="print:hidden">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de desconto">
                  <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as '' | 'PERCENT' | 'AMOUNT')} disabled={!isOpen}>
                    <option value="">Sem desconto</option>
                    <option value="PERCENT">Percentual (%)</option>
                    <option value="AMOUNT">Valor (R$)</option>
                  </Select>
                </Field>
                <Field label="Valor">
                  {discountType === 'AMOUNT' ? (
                    <MoneyInput value={discountValue} onChange={setDiscountValue} disabled={!isOpen} />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-50"
                      value={discountValue}
                      disabled={!isOpen || !discountType}
                      onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                    />
                  )}
                </Field>
              </div>
              {!consumption && (
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">Inserir no caixa</span>
                    <span className="block text-xs text-muted-foreground">Lança os recebimentos no caixa aberto ao fechar</span>
                  </span>
                  <Switch checked={addToCashier} onCheckedChange={setAddToCashier} disabled={!isOpen} />
                </label>
              )}
              <Field label="Observações">
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isOpen} maxLength={1000} />
              </Field>
              {isOpen && (
                <Button variant="outline" className="w-full" disabled={!discountDirty} loading={saveDiscount.isPending} onClick={() => saveDiscount.mutate()}>
                  Salvar
                </Button>
              )}
            </div>
          </Section>
          {!isOpen && order.notes && (
            <Card className="hidden p-4 text-sm print:block">
              <b>Obs.:</b> {order.notes}
            </Card>
          )}
        </div>
      </div>

      {isOpen && <AddItemDialog order={order} open={addOpen} onOpenChange={setAddOpen} onDone={setOrder} />}
      <EditItemDialog order={order} item={editItem} onOpenChange={(o) => !o && setEditItem(null)} onDone={setOrder} />

      <ConfirmDialog
        open={!!removeItemId}
        onOpenChange={(o) => !o && setRemoveItemId(null)}
        title="Remover item?"
        confirmText="Remover"
        variant="destructive"
        loading={removeItem.isPending}
        onConfirm={() => {
          if (removeItemId) removeItem.mutate(removeItemId);
        }}
      />

      {/* fechar */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent size="sm" title={`Fechar comanda #${order.number}`}>
          <div className="space-y-2 text-sm">
            <Row label="Total" value={money(order.total)} className="font-semibold" />
            <Row label="Pago" value={money(order.paidTotal)} />
            {remaining > 0.009 ? (
              <div className="rounded-md bg-amber-50 p-3 text-amber-900">
                Faltam <b>{money(remaining)}</b>. Lance os pagamentos ou feche com saldo em aberto (fiado) — será gerada uma conta a receber{!order.client && ', mas a comanda precisa de cliente'}.
              </div>
            ) : (
              <p className="text-muted-foreground">
                Ao fechar: {order.addToCashier && !consumption ? 'lança no caixa, ' : ''}baixa estoque, gera comissões e pontua a fidelidade.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Voltar
            </Button>
            {remaining > 0.009 ? (
              <Button variant="dark" onClick={() => close.mutate(true)} loading={close.isPending} disabled={!order.client}>
                Fechar com saldo em aberto
              </Button>
            ) : (
              <Button variant="success" onClick={() => close.mutate(false)} loading={close.isPending}>
                Confirmar fechamento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar comanda?"
        description="A comanda será cancelada. Pontos resgatados são estornados e o agendamento volta a confirmado."
        confirmText="Cancelar comanda"
        cancelText="Voltar"
        variant="destructive"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reabrir comanda?"
        description="Estorna lançamentos no caixa, comissões, estoque e pontos desta comanda."
        confirmText="Reabrir"
        loading={reopen.isPending}
        onConfirm={() => reopen.mutate()}
      />
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
