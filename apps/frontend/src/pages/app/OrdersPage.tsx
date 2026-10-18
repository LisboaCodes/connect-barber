import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, DollarSign, Plus, Receipt, Search, Wallet } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Pagination, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { ordersApi, type OrderStatus } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { fmtDateTime, fmtTime, money, PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL, toISODate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { NewOrderDialog } from '@/components/orders/NewOrderDialog';
import { useDebounced } from '@/components/agenda/ClientSearch';

export default function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus>('OPEN');
  const [date, setDate] = useState(toISODate(new Date()));
  const [allOpen, setAllOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const term = useDebounced(search.trim(), 350);

  const summaryQ = useQuery({ queryKey: ['orders-summary', date], queryFn: () => ordersApi.summary(date), refetchInterval: 60_000 });
  const useDate = !(status === 'OPEN' && allOpen);
  const listQ = useQuery({
    queryKey: ['orders', status, useDate ? date : 'all', term, page],
    queryFn: () => ordersApi.list({ status, date: useDate ? date : undefined, search: term || undefined, page, limit: 30 }),
    placeholderData: (prev) => prev,
  });

  const s = summaryQ.data;
  const items = listQ.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Comandas"
        description="Atendimentos, vendas e pagamentos"
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus /> Nova comanda
          </Button>
        }
      />

      {/* resumo do dia */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Comandas abertas" value={s?.open ?? 0} icon={ClipboardList} hint="no momento" />
            <StatCard label="Fechadas no dia" value={s?.closedCount ?? 0} icon={Receipt} />
            <StatCard label="Faturamento do dia" value={money(s?.revenue)} icon={DollarSign} />
            <StatCard label="Taxas de pagamento" value={money(s?.fees)} icon={Wallet} hint={s ? `líquido ${money((s.revenue ?? 0) - (s.fees ?? 0))}` : undefined} />
          </>
        )}
      </div>
      {s && s.byMethod.length > 0 && (
        <Card className="mb-5 flex flex-wrap gap-2 p-3">
          <span className="self-center text-xs font-medium text-muted-foreground">Recebido por forma:</span>
          {s.byMethod.map((m) => (
            <span key={m.method} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">
              {PAYMENT_LABEL[m.method] ?? m.method}: <b>{money(m.amount)}</b>
            </span>
          ))}
        </Card>
      )}

      {/* filtros */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as OrderStatus);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="OPEN">Abertas</TabsTrigger>
            <TabsTrigger value="CLOSED">Fechadas</TabsTrigger>
            <TabsTrigger value="CANCELLED">Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          {status === 'OPEN' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={allOpen} onChange={(e) => { setAllOpen(e.target.checked); setPage(1); }} className="accent-amber-500" /> Todas as abertas
            </label>
          )}
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              setDate(e.target.value);
              setPage(1);
              if (status === 'OPEN') setAllOpen(false);
            }}
            className="w-40"
          />
          <Input
            prefix={<Search className="h-4 w-4" />}
            placeholder="Nº ou cliente"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-56"
          />
        </div>
      </div>

      {listQ.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : listQ.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage(listQ.error)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={status === 'OPEN' ? 'Nenhuma comanda aberta' : status === 'CLOSED' ? 'Nenhuma comanda fechada' : 'Nenhuma comanda cancelada'}
          description={status === 'OPEN' ? 'Abra uma comanda nova ou a partir de um agendamento na agenda.' : 'Ajuste a data ou a busca.'}
          action={
            status === 'OPEN' ? (
              <Button onClick={() => setNewOpen(true)}>
                <Plus /> Nova comanda
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          {/* desktop */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Nº</TH>
                  <TH>Cliente</TH>
                  <TH>Profissional</TH>
                  <TH>{status === 'CLOSED' ? 'Fechada' : 'Aberta'}</TH>
                  <TH className="text-right">Itens</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Pago</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((o) => (
                  <TR key={o.id} className="cursor-pointer" onClick={() => navigate(`/app/comandas/${o.id}`)}>
                    <TD className="font-semibold">#{o.number}</TD>
                    <TD>
                      <div className="font-medium">{o.client?.name ?? (o.kind === 'PROFESSIONAL_CONSUMPTION' ? 'Consumo interno' : 'Sem cliente')}</div>
                      {o.kind === 'PROFESSIONAL_CONSUMPTION' && <div className="text-xs text-muted-foreground">Consumo do profissional</div>}
                    </TD>
                    <TD>
                      {o.professional ? (
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.professional.color }} />
                          {o.professional.name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TD>
                    <TD className="text-muted-foreground">{fmtDateTime(status === 'CLOSED' ? o.closedAt : o.openedAt)}</TD>
                    <TD className="text-right">{o.items.length}</TD>
                    <TD className="text-right font-semibold">{money(o.total)}</TD>
                    <TD className={cn('text-right', Number(o.paidTotal) < Number(o.total) ? 'text-amber-700' : 'text-emerald-700')}>{money(o.paidTotal)}</TD>
                    <TD>
                      <Badge className={cn('border', STATUS_COLOR[o.status])}>{STATUS_LABEL[o.status]}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {/* mobile */}
          <div className="divide-y md:hidden">
            {items.map((o) => (
              <button key={o.id} onClick={() => navigate(`/app/comandas/${o.id}`)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-800">#{o.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.client?.name ?? (o.kind === 'PROFESSIONAL_CONSUMPTION' ? 'Consumo interno' : 'Sem cliente')}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {fmtTime(o.openedAt)} · {o.professional?.name ?? 'sem profissional'} · {o.items.length} item(s)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(o.total)}</div>
                  <Badge className={cn('border text-[10px]', STATUS_COLOR[o.status])}>{STATUS_LABEL[o.status]}</Badge>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t p-3">
            <Pagination page={listQ.data?.page ?? 1} pages={listQ.data?.pages ?? 1} total={listQ.data?.total} onChange={setPage} />
          </div>
        </Card>
      )}

      <NewOrderDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
