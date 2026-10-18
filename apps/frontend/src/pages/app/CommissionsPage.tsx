import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Banknote, Percent, Plus, Trash2, Undo2 } from 'lucide-react';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Pagination, Select, Skeleton, Table, Tabs, TabsContent, TabsList, TabsTrigger, TBody, TD, TH, THead, TR } from '@/components/ui';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { AdvanceDialog, PayoutDetailDialog, PayoutDialog } from '@/components/finance/CommissionDialogs';
import { errorMessage } from '@/lib/api/client';
import { commissionsApi, type Advance, type Payout } from '@/lib/api/commissions';
import { fmtDate, money, num, PAYMENT_LABEL } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

const d10 = (s: string) => fmtDate(s.slice(0, 10) + 'T12:00:00');
const ENTRY_STATUS: Record<string, { label: string; variant: 'warning' | 'success' | 'secondary' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  PAID: { label: 'Pago', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'secondary' },
};
const ADVANCE_STATUS: Record<string, { label: string; variant: 'warning' | 'success' | 'secondary' }> = {
  OPEN: { label: 'Em aberto', variant: 'warning' },
  SETTLED: { label: 'Descontado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'secondary' },
};

export default function CommissionsPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.current?.role);
  const isManager = role === 'OWNER' || role === 'ADMIN';
  const isPro = role === 'PROFESSIONAL';
  const [period, setPeriod] = usePeriod('month');
  const [professionalId, setProfessionalId] = useState('');
  const [tab, setTab] = useState('lancamentos');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [payoutDefaults, setPayoutDefaults] = useState<{ professionalId?: string; periodStart: string; periodEnd: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelAdvance, setCancelAdvance] = useState<Advance | null>(null);
  const [undoPayout, setUndoPayout] = useState<Payout | null>(null);

  useEffect(() => setPage(1), [period.from, period.to, professionalId, status]);

  const pros = useQuery({ queryKey: ['professionals', 'lite'], queryFn: commissionsApi.professionals, enabled: !isPro });
  const summary = useQuery({ queryKey: ['commissions', 'summary', period.from, period.to, professionalId], queryFn: () => commissionsApi.summary(period.from, period.to, professionalId || undefined) });
  const entriesQ = { from: period.from, to: period.to, professionalId: professionalId || undefined, status: status || undefined, page, limit: 50 };
  const entries = useQuery({ queryKey: ['commissions', 'entries', entriesQ], queryFn: () => commissionsApi.entries(entriesQ), placeholderData: keepPreviousData, enabled: tab === 'lancamentos' });
  const advances = useQuery({ queryKey: ['commissions', 'advances', professionalId], queryFn: () => commissionsApi.advances({ professionalId: professionalId || undefined }), enabled: tab === 'vales' });
  const payouts = useQuery({ queryKey: ['commissions', 'payouts', professionalId], queryFn: () => commissionsApi.payouts(professionalId || undefined), enabled: tab === 'fechamentos' });

  const professionals = useMemo(() => pros.data ?? summary.data?.map((s) => s.professional) ?? [], [pros.data, summary.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['commissions'] });
    qc.invalidateQueries({ queryKey: ['finance'] });
  };
  const cancelAdv = useMutation({
    mutationFn: (id: string) => commissionsApi.cancelAdvance(id),
    onSuccess: () => {
      toast.success('Vale cancelado');
      invalidate();
      setCancelAdvance(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const undo = useMutation({
    mutationFn: (id: string) => commissionsApi.deletePayout(id),
    onSuccess: () => {
      toast.success('Fechamento desfeito; comissões voltaram a pendentes');
      invalidate();
      setUndoPayout(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const totals = (summary.data ?? []).reduce((s, r) => ({ pending: s.pending + r.pending, paid: s.paid + r.paid, advances: s.advances + r.openAdvances }), { pending: 0, paid: 0, advances: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={isPro ? 'Minhas comissões' : 'Comissões'}
        description="Comissões geradas nas comandas, vales e fechamentos."
        className="mb-0"
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} presets={['week', 'month', 'last30', 'lastMonth']} />
            {!isPro && (
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className="h-8 w-44 text-xs">
                <option value="">Todos os profissionais</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pendente no período</div>
          <div className="mt-1 text-xl font-bold text-amber-600">{money(totals.pending)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pago no período</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{money(totals.paid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vales em aberto</div>
          <div className="mt-1 text-xl font-bold text-red-600">{money(totals.advances)}</div>
        </Card>
      </div>

      {summary.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : summary.error ? (
        <Card className="p-4 text-sm text-red-700">{errorMessage(summary.error)}</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(summary.data ?? []).map((r) => (
            <Card key={r.professional.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar src={r.professional.avatarUrl} name={r.professional.name} color={r.professional.color ?? undefined} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.professional.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Serviços {num(r.professional.serviceCommissionPct ?? 0, 0)}% · Produtos {num(r.professional.productCommissionPct ?? 0, 0)}%
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Pendente ({r.pendingCount})</div>
                  <div className="font-bold text-amber-600 tabular-nums">{money(r.pending)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pago</div>
                  <div className="font-bold text-emerald-600 tabular-nums">{money(r.paid)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Serviços / Produtos</div>
                  <div className="tabular-nums">
                    {money(r.services)} / {money(r.products)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vales em aberto</div>
                  <div className="tabular-nums text-red-600">{money(r.openAdvances)}</div>
                </div>
              </div>
              {isManager && (
                <Button size="sm" variant="outline" className="mt-3 w-full" disabled={!r.pending && !r.openAdvances} onClick={() => setPayoutDefaults({ professionalId: r.professional.id, periodStart: period.from, periodEnd: period.to })}>
                  <Banknote /> Fechar comissão
                </Button>
              )}
            </Card>
          ))}
          {!summary.data?.length && <EmptyState icon={Percent} title="Nenhum profissional" className="sm:col-span-2 xl:col-span-3" />}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="vales">Vales</TabsTrigger>
            <TabsTrigger value="fechamentos">Fechamentos</TabsTrigger>
          </TabsList>
          {isManager && tab === 'vales' && (
            <Button size="sm" onClick={() => setAdvanceOpen(true)}>
              <Plus /> Novo vale
            </Button>
          )}
          {isManager && tab === 'fechamentos' && (
            <Button size="sm" onClick={() => setPayoutDefaults({ professionalId: professionalId || undefined, periodStart: period.from, periodEnd: period.to })}>
              <Plus /> Novo fechamento
            </Button>
          )}
          {tab === 'lancamentos' && (
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-40 text-xs">
              <option value="">Todos os status</option>
              <option value="PENDING">Pendentes</option>
              <option value="PAID">Pagos</option>
              <option value="CANCELLED">Cancelados</option>
            </Select>
          )}
        </div>

        <TabsContent value="lancamentos" className="space-y-3">
          <Card>
            {entries.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : !entries.data?.items.length ? (
              <EmptyState title="Nenhuma comissão no período" description="As comissões são geradas ao fechar comandas." className="m-4 border-0" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    {!isPro && <TH>Profissional</TH>}
                    <TH>Item</TH>
                    <TH className="hidden md:table-cell">Cliente</TH>
                    <TH className="text-right">Base</TH>
                    <TH className="text-right">%</TH>
                    <TH className="text-right">Comissão</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {entries.data.items.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap">{d10(e.referenceDate)}</TD>
                      {!isPro && <TD>{e.professional.name}</TD>}
                      <TD>
                        {e.orderItem?.quantity && e.orderItem.quantity > 1 ? `${e.orderItem.quantity}x ` : ''}
                        {e.orderItem?.description}
                        {e.order && <span className="text-xs text-muted-foreground"> · #{e.order.number}</span>}
                      </TD>
                      <TD className="hidden text-muted-foreground md:table-cell">{e.order?.client?.name ?? '-'}</TD>
                      <TD className="text-right tabular-nums">{money(e.baseAmount)}</TD>
                      <TD className="text-right tabular-nums">{num(e.pct, 0)}%</TD>
                      <TD className="text-right font-medium tabular-nums">{money(e.amount)}</TD>
                      <TD>
                        <Badge variant={ENTRY_STATUS[e.status]?.variant}>{ENTRY_STATUS[e.status]?.label ?? e.status}</Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          {entries.data && <Pagination page={page} pages={entries.data.pages} total={entries.data.total} onChange={setPage} />}
        </TabsContent>

        <TabsContent value="vales">
          <Card>
            {advances.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-20" />
              </div>
            ) : !advances.data?.length ? (
              <EmptyState title="Nenhum vale registrado" description="Vales são adiantamentos descontados no fechamento." className="m-4 border-0" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    {!isPro && <TH>Profissional</TH>}
                    <TH>Descrição</TH>
                    <TH className="text-right">Valor</TH>
                    <TH>Status</TH>
                    {isManager && <TH className="w-10" />}
                  </TR>
                </THead>
                <TBody>
                  {advances.data.map((a) => (
                    <TR key={a.id}>
                      <TD className="whitespace-nowrap">{d10(a.date)}</TD>
                      {!isPro && <TD>{a.professional?.name}</TD>}
                      <TD className="text-muted-foreground">{a.description || '-'}</TD>
                      <TD className="text-right font-medium tabular-nums">{money(a.amount)}</TD>
                      <TD>
                        <Badge variant={ADVANCE_STATUS[a.status]?.variant}>{ADVANCE_STATUS[a.status]?.label ?? a.status}</Badge>
                      </TD>
                      {isManager && (
                        <TD>
                          {a.status === 'OPEN' && (
                            <Button size="icon-sm" variant="ghost" className="text-red-600" title="Cancelar vale" onClick={() => setCancelAdvance(a)}>
                              <Trash2 />
                            </Button>
                          )}
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="fechamentos">
          <Card>
            {payouts.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-20" />
              </div>
            ) : !payouts.data?.length ? (
              <EmptyState icon={Banknote} title="Nenhum fechamento" description="Feche as comissões pendentes de um profissional para gerar o pagamento." className="m-4 border-0" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Período</TH>
                    {!isPro && <TH>Profissional</TH>}
                    <TH className="hidden text-right md:table-cell">Comissões</TH>
                    <TH className="hidden text-right md:table-cell">Descontos</TH>
                    <TH className="text-right">Líquido</TH>
                    <TH>Status</TH>
                    <TH className="w-20" />
                  </TR>
                </THead>
                <TBody>
                  {payouts.data.map((p) => (
                    <TR key={p.id}>
                      <TD className="whitespace-nowrap">
                        {d10(p.periodStart)} a {d10(p.periodEnd)}
                      </TD>
                      {!isPro && <TD>{p.professional.name}</TD>}
                      <TD className="hidden text-right tabular-nums md:table-cell">{money(p.commissionsTotal)}</TD>
                      <TD className="hidden text-right tabular-nums text-red-600 md:table-cell">{money(-(Number(p.advancesTotal) + Number(p.consumptionTotal)))}</TD>
                      <TD className="text-right font-semibold tabular-nums">{money(p.netAmount)}</TD>
                      <TD>{p.paidAt ? <Badge variant="success">Pago{p.method ? ` · ${PAYMENT_LABEL[p.method] ?? p.method}` : ''}</Badge> : <Badge variant="warning">A pagar</Badge>}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button size="icon-sm" variant="ghost" title="Detalhes" onClick={() => setDetailId(p.id)}>
                            <Eye />
                          </Button>
                          {isManager && !p.paidAt && (
                            <Button size="icon-sm" variant="ghost" className="text-red-600" title="Desfazer fechamento" onClick={() => setUndoPayout(p)}>
                              <Undo2 />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {isManager && (
        <>
          <AdvanceDialog open={advanceOpen} onOpenChange={setAdvanceOpen} professionals={professionals} defaultProfessionalId={professionalId || undefined} />
          <PayoutDialog open={!!payoutDefaults} onOpenChange={(o) => !o && setPayoutDefaults(null)} professionals={professionals} defaults={payoutDefaults ?? undefined} />
        </>
      )}
      <PayoutDetailDialog id={detailId} onOpenChange={(o) => !o && setDetailId(null)} canManage={isManager} />
      <ConfirmDialog open={!!cancelAdvance} onOpenChange={(o) => !o && setCancelAdvance(null)} title="Cancelar vale?" description={cancelAdvance ? `Vale de ${money(cancelAdvance.amount)} para ${cancelAdvance.professional?.name ?? 'profissional'}. Movimentos de caixa já lançados não são estornados automaticamente.` : undefined} confirmText="Cancelar vale" cancelText="Voltar" variant="destructive" loading={cancelAdv.isPending} onConfirm={() => { if (cancelAdvance) cancelAdv.mutate(cancelAdvance.id); }} />
      <ConfirmDialog open={!!undoPayout} onOpenChange={(o) => !o && setUndoPayout(null)} title="Desfazer fechamento?" description="As comissões e vales voltam a ficar pendentes/em aberto." confirmText="Desfazer" cancelText="Voltar" variant="destructive" loading={undo.isPending} onConfirm={() => { if (undoPayout) undo.mutate(undoPayout.id); }} />
    </div>
  );
}
