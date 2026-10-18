import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, Wallet } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Input, Pagination, Select, Skeleton, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { EntryDialog, PayDialog } from './EntryDialogs';
import { errorMessage } from '@/lib/api/client';
import { financeApi, type FinanceCategory, type FinanceEntry, type FinanceType } from '@/lib/api/finance';
import { cn } from '@/lib/utils/cn';
import { fmtDate, money, PAYMENT_LABEL } from '@/lib/utils/format';

type Confirm = { kind: 'unpay' | 'cancel' | 'remove'; entry: FinanceEntry } | null;

export function EntriesTab({ type, categories }: { type: FinanceType; categories: FinanceCategory[] }) {
  const qc = useQueryClient();
  const [period, setPeriod] = usePeriod('month');
  const [status, setStatus] = useState('PENDING');
  const [overdue, setOverdue] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<FinanceEntry | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const isExpense = type === 'EXPENSE';

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [period.from, period.to, status, overdue, categoryId, debounced]);

  const query = { type, status: status || undefined, from: overdue ? undefined : period.from, to: overdue ? undefined : period.to, categoryId: categoryId || undefined, search: debounced || undefined, overdue, page, limit: 30 };
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ['finance', 'entries', query], queryFn: () => financeApi.list(query), placeholderData: keepPreviousData });

  const action = useMutation({
    mutationFn: ({ kind, entry }: NonNullable<Confirm>) => (kind === 'unpay' ? financeApi.unpay(entry.id) : kind === 'cancel' ? financeApi.cancel(entry.id) : financeApi.remove(entry.id)),
    onSuccess: (_d, v) => {
      toast.success(v.kind === 'unpay' ? 'Pagamento estornado' : v.kind === 'cancel' ? 'Lançamento cancelado' : 'Lançamento excluído');
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      setConfirm(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const totals = data?.totals ?? [];
  const sum = (st: string, field: 'amount' | 'paid' = 'amount') => totals.filter((t) => t.status === st).reduce((s, t) => s + t[field], 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{isExpense ? 'A pagar' : 'A receber'} (filtro)</div>
          <div className="mt-1 text-xl font-bold text-amber-600">{money(sum('PENDING'))}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{isExpense ? 'Pago' : 'Recebido'} (filtro)</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{money(sum('PAID', 'paid'))}</div>
        </Card>
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-xs text-muted-foreground">Lançamentos</div>
            <div className="mt-1 text-xl font-bold">{data?.total ?? 0}</div>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> {isExpense ? 'Nova despesa' : 'Nova receita'}
          </Button>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(overdue && 'pointer-events-none opacity-50')}>
          <PeriodPicker value={period} onChange={setPeriod} presets={['week', 'month', 'last30', 'lastMonth']} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" disabled={overdue}>
          <option value="PENDING">Pendentes</option>
          <option value="PAID">{isExpense ? 'Pagas' : 'Recebidas'}</option>
          <option value="CANCELLED">Canceladas</option>
          <option value="">Todas</option>
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-44">
          <option value="">Todas as categorias</option>
          {categories
            .filter((c) => c.type === type)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Button variant={overdue ? 'destructive' : 'outline'} size="sm" className="h-9" onClick={() => setOverdue((o) => !o)}>
          Somente vencidas
        </Button>
        <Input prefix={<Search className="h-4 w-4" />} placeholder="Buscar descrição ou fornecedor" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[200px] flex-1" />
      </div>

      <Card className={cn(isFetching && 'opacity-80')}>
        {error ? (
          <div className="p-6 text-sm text-red-700">{errorMessage(error)}</div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState icon={Wallet} title="Nenhum lançamento encontrado" description="Ajuste os filtros ou cadastre um novo lançamento." className="m-4 border-0" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Vencimento</TH>
                <TH>Descrição</TH>
                <TH className="hidden md:table-cell">Categoria</TH>
                <TH className="text-right">Valor</TH>
                <TH>Status</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {data.items.map((e) => {
                const overdueRow = e.overdue || (e.status === 'PENDING' && e.dueDate.slice(0, 10) < today);
                return (
                  <TR key={e.id} className={cn(e.status === 'CANCELLED' && 'opacity-60')}>
                    <TD className={cn('whitespace-nowrap tabular-nums', overdueRow && 'font-medium text-red-600')}>{fmtDate(e.dueDate.slice(0, 10) + 'T12:00:00')}</TD>
                    <TD>
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {[e.supplier, e.status === 'PAID' && e.paidAt ? `${isExpense ? 'pago' : 'recebido'} em ${fmtDate(e.paidAt)}${e.method ? ` · ${PAYMENT_LABEL[e.method] ?? e.method}` : ''}` : null, e.orderId ? 'gerado por comanda' : null].filter(Boolean).join(' · ')}
                      </div>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{e.category?.name ?? '-'}</TD>
                    <TD className="text-right font-medium tabular-nums">
                      {money(e.status === 'PAID' && e.paidAmount !== null ? e.paidAmount : e.amount)}
                      {e.status === 'PAID' && e.paidAmount !== null && Number(e.paidAmount) !== Number(e.amount) && <div className="text-xs font-normal text-muted-foreground line-through">{money(e.amount)}</div>}
                    </TD>
                    <TD>
                      {e.status === 'PAID' ? (
                        <Badge variant="success">{isExpense ? 'Pago' : 'Recebido'}</Badge>
                      ) : e.status === 'CANCELLED' ? (
                        <Badge variant="secondary">Cancelado</Badge>
                      ) : overdueRow ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : (
                        <Badge variant="warning">Pendente</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {e.status === 'PENDING' && (
                          <Button size="sm" variant="outline" className="hidden h-7 sm:inline-flex" onClick={() => setPaying(e)}>
                            {isExpense ? 'Pagar' : 'Receber'}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {e.status === 'PENDING' && (
                              <DropdownMenuItem onSelect={() => setPaying(e)}>
                                <CheckCircle2 /> {isExpense ? 'Registrar pagamento' : 'Registrar recebimento'}
                              </DropdownMenuItem>
                            )}
                            {e.status === 'PAID' && (
                              <DropdownMenuItem onSelect={() => setConfirm({ kind: 'unpay', entry: e })}>
                                <RotateCcw /> Estornar
                              </DropdownMenuItem>
                            )}
                            {e.status === 'PENDING' && (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(e);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil /> Editar
                              </DropdownMenuItem>
                            )}
                            {e.status === 'PENDING' && (
                              <DropdownMenuItem onSelect={() => setConfirm({ kind: 'cancel', entry: e })}>
                                <Ban /> Cancelar
                              </DropdownMenuItem>
                            )}
                            {e.status !== 'PAID' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onSelect={() => setConfirm({ kind: 'remove', entry: e })}>
                                  <Trash2 /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
      {data && <Pagination page={page} pages={data.pages} total={data.total} onChange={setPage} />}

      <EntryDialog open={formOpen} onOpenChange={setFormOpen} type={type} entry={editing} categories={categories} />
      <PayDialog entry={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === 'unpay' ? 'Estornar pagamento?' : confirm?.kind === 'cancel' ? 'Cancelar lançamento?' : 'Excluir lançamento?'}
        description={confirm ? `${confirm.entry.description} · ${money(confirm.entry.amount)}${confirm.kind === 'unpay' ? '. O lançamento volta a ficar pendente e o movimento no caixa (se houver) é removido.' : confirm.kind === 'remove' ? '. Esta ação não pode ser desfeita.' : ''}` : undefined}
        confirmText={confirm?.kind === 'unpay' ? 'Estornar' : confirm?.kind === 'cancel' ? 'Cancelar lançamento' : 'Excluir'}
        cancelText="Voltar"
        variant={confirm?.kind === 'remove' ? 'destructive' : 'default'}
        loading={action.isPending}
        onConfirm={() => { if (confirm) action.mutate(confirm); }}
      />
    </div>
  );
}
