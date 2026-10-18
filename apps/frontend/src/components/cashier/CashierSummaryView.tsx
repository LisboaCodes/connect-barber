import { ArrowDownCircle, ArrowUpCircle, Banknote, Coins, Receipt, Trash2, Wallet } from 'lucide-react';
import { Badge, Button, Card, EmptyState, StatCard, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { MOVEMENT_LABEL, type CashMovement, type CashierSummary } from '@/lib/api/cashier';
import { fmtDateTime, fmtTime, money, PAYMENT_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const TYPE_STYLE: Record<string, string> = {
  SALE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INCOME: 'bg-sky-100 text-sky-800 border-sky-200',
  EXPENSE: 'bg-red-100 text-red-800 border-red-200',
  WITHDRAWAL: 'bg-rose-100 text-rose-800 border-rose-200',
  SUPPLY: 'bg-amber-100 text-amber-800 border-amber-200',
};

export const isOutflow = (t: string) => t === 'EXPENSE' || t === 'WITHDRAWAL';

export function CashierSummaryView({ summary, onRemove, removingId, longDates }: { summary: CashierSummary; onRemove?: (m: CashMovement) => void; removingId?: string | null; longDates?: boolean }) {
  const outflow = summary.expense + summary.withdrawal;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saldo inicial" value={money(summary.openingBalance)} icon={Wallet} />
        <StatCard label="Vendas (comandas)" value={money(summary.sales)} icon={Receipt} hint={summary.income ? `+ ${money(summary.income)} outras entradas` : undefined} />
        <StatCard label="Saídas" value={money(outflow)} icon={ArrowDownCircle} hint={`Despesas ${money(summary.expense)} · Sangrias ${money(summary.withdrawal)}`} />
        <StatCard label="Suprimentos" value={money(summary.supply)} icon={ArrowUpCircle} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-amber-300 bg-amber-50 p-5 md:col-span-1">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <Banknote className="h-4 w-4" /> Dinheiro esperado na gaveta
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-900">{money(summary.expectedCash)}</div>
          <div className="mt-1 text-xs text-amber-800">Saldo inicial + movimentos em dinheiro</div>
        </Card>
        <Card className="p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4" /> Recebimentos por forma de pagamento
            </span>
            <span className="text-sm">
              Movimento líquido: <b>{money(summary.total)}</b>
            </span>
          </div>
          {summary.byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum recebimento ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {summary.byMethod.map((m) => (
                <div key={m.method} className="rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{PAYMENT_LABEL[m.method] ?? m.method}</div>
                  <div className="font-semibold">{money(m.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="border-b px-5 py-3 text-sm font-semibold">Movimentações ({summary.movements.length})</div>
        {summary.movements.length === 0 ? (
          <EmptyState title="Sem movimentações" description="Vendas de comandas e lançamentos manuais aparecem aqui." className="m-4" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Hora</TH>
                <TH>Tipo</TH>
                <TH className="hidden sm:table-cell">Forma</TH>
                <TH>Descrição</TH>
                <TH className="text-right">Valor</TH>
                {onRemove && <TH className="w-10" />}
              </TR>
            </THead>
            <TBody>
              {[...summary.movements].reverse().map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{longDates ? fmtDateTime(m.createdAt) : fmtTime(m.createdAt)}</TD>
                  <TD>
                    <Badge className={cn('border', TYPE_STYLE[m.type])}>{MOVEMENT_LABEL[m.type]}</Badge>
                  </TD>
                  <TD className="hidden sm:table-cell">{PAYMENT_LABEL[m.method] ?? m.method}</TD>
                  <TD className="max-w-[220px] truncate">{m.description || '-'}</TD>
                  <TD className={cn('whitespace-nowrap text-right font-semibold tabular-nums', isOutflow(m.type) ? 'text-red-600' : 'text-emerald-700')}>
                    {isOutflow(m.type) ? '-' : '+'}
                    {money(m.amount)}
                  </TD>
                  {onRemove && (
                    <TD>
                      {m.type !== 'SALE' && (
                        <Button variant="ghost" size="icon-sm" onClick={() => onRemove(m)} disabled={removingId === m.id} title="Remover">
                          <Trash2 className="text-red-600" />
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
    </div>
  );
}

export default CashierSummaryView;
