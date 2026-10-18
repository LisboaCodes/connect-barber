import { useQuery } from '@tanstack/react-query';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, PageLoader, StatCard, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { AXIS, ChartEmpty, ChartTooltip, CHART_COLORS, compactMoney, GRID } from '@/components/reports/charts';
import { errorMessage } from '@/lib/api/client';
import { financeApi } from '@/lib/api/finance';
import { cn } from '@/lib/utils/cn';
import { fmtDate, money } from '@/lib/utils/format';

const dd = (d: string) => fmtDate(d + 'T12:00:00', 'dd/MM');

export function CashflowTab() {
  const [period, setPeriod] = usePeriod('month');
  const { data, isLoading, error } = useQuery({ queryKey: ['finance', 'cashflow', period.from, period.to], queryFn: () => financeApi.cashflow(period.from, period.to) });

  let running = 0;
  const rows = (data?.days ?? []).map((d) => {
    running += d.balance;
    return { ...d, inflow: d.sales + d.otherIncome, outflow: -(d.expenses + d.commissions), accumulated: Math.round(running * 100) / 100 };
  });
  const t = data?.totals;
  const pendingIn = data?.pending.find((p) => p.type === 'INCOME')?.amount ?? 0;
  const pendingOut = data?.pending.find((p) => p.type === 'EXPENSE')?.amount ?? 0;

  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={setPeriod} presets={['week', 'month', 'last30', 'lastMonth']} />
      {error ? (
        <Card className="p-4 text-sm text-red-700">{errorMessage(error)}</Card>
      ) : isLoading || !data || !t ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Entradas" value={<span className="text-emerald-600">{money(t.sales + t.otherIncome)}</span>} hint={`Vendas ${money(t.sales)} · Outras ${money(t.otherIncome)}`} />
            <StatCard label="Saídas" value={<span className="text-red-600">{money(t.expenses + t.commissions)}</span>} hint={`Despesas ${money(t.expenses)} · Comissões ${money(t.commissions)}`} />
            <StatCard label="Saldo do período" value={<span className={t.balance < 0 ? 'text-red-600' : ''}>{money(t.balance)}</span>} hint={t.cardFees ? `Taxas de cartão: ${money(t.cardFees)}` : undefined} />
            <StatCard label="Pendentes (geral)" value={money(pendingIn - pendingOut)} hint={`A receber ${money(pendingIn)} · A pagar ${money(pendingOut)}`} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Entradas x saídas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {!rows.length ? (
                <ChartEmpty height={280} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={dd} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={12} />
                    <YAxis tickFormatter={compactMoney} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<ChartTooltip labelFormatter={dd} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inflow" name="Entradas" fill={CHART_COLORS[2]} stackId="s" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="outflow" name="Saídas" fill={CHART_COLORS[7]} stackId="s" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line dataKey="accumulated" name="Saldo acumulado" type="monotone" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Dia</TH>
                  <TH className="text-right">Vendas</TH>
                  <TH className="text-right">Outras receitas</TH>
                  <TH className="text-right">Despesas</TH>
                  <TH className="text-right">Comissões</TH>
                  <TH className="text-right">Saldo</TH>
                  <TH className="text-right">Acumulado</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.day}>
                    <TD className="whitespace-nowrap">{fmtDate(r.day + 'T12:00:00', 'EEE, dd/MM')}</TD>
                    <TD className="text-right tabular-nums">{money(r.sales)}</TD>
                    <TD className="text-right tabular-nums">{money(r.otherIncome)}</TD>
                    <TD className="text-right tabular-nums text-red-600">{r.expenses ? money(-r.expenses) : '-'}</TD>
                    <TD className="text-right tabular-nums text-red-600">{r.commissions ? money(-r.commissions) : '-'}</TD>
                    <TD className={cn('text-right font-medium tabular-nums', r.balance < 0 && 'text-red-600')}>{money(r.balance)}</TD>
                    <TD className={cn('text-right tabular-nums', r.accumulated < 0 && 'text-red-600')}>{money(r.accumulated)}</TD>
                  </TR>
                ))}
                {!rows.length && (
                  <TR>
                    <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                      Sem movimentações no período.
                    </TD>
                  </TR>
                )}
              </TBody>
              {rows.length > 0 && (
                <tfoot className="border-t bg-muted/40 font-semibold">
                  <tr>
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right tabular-nums">{money(t.sales)}</td>
                    <td className="p-3 text-right tabular-nums">{money(t.otherIncome)}</td>
                    <td className="p-3 text-right tabular-nums text-red-600">{money(-t.expenses)}</td>
                    <td className="p-3 text-right tabular-nums text-red-600">{money(-t.commissions)}</td>
                    <td className={cn('p-3 text-right tabular-nums', t.balance < 0 && 'text-red-600')}>{money(t.balance)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
