import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, History, Lock, Unlock, Plus, Landmark } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  MoneyInput,
  PageHeader,
  PageLoader,
  Pagination,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { cashierApi, type CashMovement, type CashierSession } from '@/lib/api/cashier';
import { errorMessage } from '@/lib/api/client';
import { fmtDateTime, money, toISODate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { CashierSummaryView } from '@/components/cashier/CashierSummaryView';
import { CloseCashierDialog, MovementDialog } from '@/components/cashier/CashierDialogs';
import { addDays } from 'date-fns';

export default function CashierPage() {
  const [tab, setTab] = useState('current');
  return (
    <div>
      <PageHeader title="Caixa" description="Abertura, movimentações e fechamento do caixa" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="current" className="gap-1">
            <Landmark className="h-3.5 w-3.5" /> Caixa atual
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          <CurrentCashier />
        </TabsContent>
        <TabsContent value="history">
          <CashierHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CurrentCashier() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['cashier', 'current'], queryFn: cashierApi.current, refetchInterval: 60_000 });
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [movement, setMovement] = useState<{ open: boolean; type: 'INCOME' | 'EXPENSE' | 'WITHDRAWAL' | 'SUPPLY' }>({ open: false, type: 'INCOME' });
  const [closeOpen, setCloseOpen] = useState(false);
  const [toRemove, setToRemove] = useState<CashMovement | null>(null);

  const open = useMutation({
    mutationFn: () => cashierApi.open({ openingBalance: Number(openingBalance) || 0, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Caixa aberto');
      setOpeningBalance('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['cashier'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashierApi.removeMovement(id),
    onSuccess: () => {
      toast.success('Movimentação removida');
      setToRemove(null);
      qc.invalidateQueries({ queryKey: ['cashier'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(q.error)}</div>;

  const { session, summary } = q.data ?? { session: null, summary: null };

  if (!session || !summary) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>Caixa fechado</CardTitle>
          <CardDescription>Abra o caixa para registrar as vendas das comandas e as movimentações do dia.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              open.mutate();
            }}
          >
            <Field label="Saldo inicial (troco na gaveta)">
              <MoneyInput value={openingBalance} onChange={setOpeningBalance} placeholder="0,00" />
            </Field>
            <Field label="Observações">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </Field>
            <Button type="submit" className="w-full" loading={open.isPending}>
              <Unlock /> Abrir caixa
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div>
            <div className="font-semibold">Caixa aberto</div>
            <div className="text-xs text-muted-foreground">
              desde {fmtDateTime(session.openedAt)}
              {session.notes ? ` · ${session.notes}` : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => setMovement({ open: true, type: 'SUPPLY' })}>
            <ArrowUpCircle /> Suprimento
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMovement({ open: true, type: 'WITHDRAWAL' })}>
            <ArrowDownCircle /> Sangria
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMovement({ open: true, type: 'INCOME' })}>
            <Plus /> Movimentação
          </Button>
          <Button variant="dark" size="sm" onClick={() => setCloseOpen(true)}>
            <Lock /> Fechar caixa
          </Button>
        </div>
      </Card>

      <CashierSummaryView summary={summary} onRemove={setToRemove} removingId={remove.isPending ? toRemove?.id : null} />

      <MovementDialog open={movement.open} defaultType={movement.type} onOpenChange={(o) => setMovement((m) => ({ ...m, open: o }))} />
      <CloseCashierDialog open={closeOpen} onOpenChange={setCloseOpen} summary={summary} />
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remover movimentação?"
        description={toRemove ? `${toRemove.description || 'Movimentação'} · ${money(toRemove.amount)}` : undefined}
        confirmText="Remover"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          if (toRemove) remove.mutate(toRemove.id);
        }}
      />
    </div>
  );
}

function CashierHistory() {
  const [from, setFrom] = useState(toISODate(addDays(new Date(), -30)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CashierSession | null>(null);

  const q = useQuery({
    queryKey: ['cashier', 'history', from, to, page],
    queryFn: () => cashierApi.history({ from: from || undefined, to: to || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });
  const detailQ = useQuery({ queryKey: ['cashier', 'session', selected?.id], queryFn: () => cashierApi.session(selected!.id), enabled: !!selected });
  const items = q.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="De">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        </Field>
        <Field label="Até">
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        </Field>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="Nenhum caixa no período" />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Abertura</TH>
                <TH className="hidden md:table-cell">Fechamento</TH>
                <TH className="hidden lg:table-cell">Responsável</TH>
                <TH className="text-right">Inicial</TH>
                <TH className="hidden text-right sm:table-cell">Esperado</TH>
                <TH className="hidden text-right sm:table-cell">Contado</TH>
                <TH className="text-right">Diferença</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s) => {
                const d = Number(s.difference ?? 0);
                return (
                  <TR key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                    <TD className="whitespace-nowrap">{fmtDateTime(s.openedAt)}</TD>
                    <TD className="hidden whitespace-nowrap md:table-cell">{s.closedAt ? fmtDateTime(s.closedAt) : '-'}</TD>
                    <TD className="hidden lg:table-cell">
                      <div className="text-sm">{s.openedBy ?? '-'}</div>
                      {s.closedBy && s.closedBy !== s.openedBy && <div className="text-xs text-muted-foreground">fechou: {s.closedBy}</div>}
                    </TD>
                    <TD className="text-right">{money(s.openingBalance)}</TD>
                    <TD className="hidden text-right sm:table-cell">{s.expectedBalance !== null ? money(s.expectedBalance) : '-'}</TD>
                    <TD className="hidden text-right sm:table-cell">{s.closingBalance !== null ? money(s.closingBalance) : '-'}</TD>
                    <TD className={cn('text-right font-semibold', s.status === 'OPEN' ? 'text-muted-foreground' : Math.abs(d) < 0.01 ? 'text-emerald-700' : d > 0 ? 'text-sky-700' : 'text-red-600')}>
                      {s.status === 'OPEN' ? '-' : `${d > 0 ? '+' : ''}${money(d)}`}
                    </TD>
                    <TD>
                      <Badge variant={s.status === 'OPEN' ? 'success' : 'secondary'}>{s.status === 'OPEN' ? 'Aberto' : 'Fechado'}</Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="border-t p-3">
            <Pagination page={q.data?.page ?? 1} pages={q.data?.pages ?? 1} total={q.data?.total} onChange={setPage} />
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent size="xl" title="Detalhe do caixa" description={selected ? `${fmtDateTime(selected.openedAt)}${selected.closedAt ? ` até ${fmtDateTime(selected.closedAt)}` : ' · aberto'}` : undefined}>
          {detailQ.isLoading || !detailQ.data ? (
            <PageLoader />
          ) : (
            <div className="space-y-4">
              {detailQ.data.session.status === 'CLOSED' && (
                <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Esperado</div>
                    <div className="font-semibold">{money(detailQ.data.session.expectedBalance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Contado</div>
                    <div className="font-semibold">{money(detailQ.data.session.closingBalance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Diferença</div>
                    <div className={cn('font-semibold', Number(detailQ.data.session.difference ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700')}>{money(detailQ.data.session.difference)}</div>
                  </div>
                </div>
              )}
              {detailQ.data.session.notes && <p className="text-sm text-muted-foreground">Obs.: {detailQ.data.session.notes}</p>}
              <CashierSummaryView summary={detailQ.data.summary} longDates />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
