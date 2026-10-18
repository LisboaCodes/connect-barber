import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, MessageCircle } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, PageLoader, Select, StatCard, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { CHART_COLORS, ColumnChart, DonutChart, HBarList, PRIMARY } from './charts';
import { downloadCSV } from './csv';
import { reportsApi, type Period } from '@/lib/api/reports';
import { commissionsApi } from '@/lib/api/commissions';
import { errorMessage } from '@/lib/api/client';
import { fmtDateTime, minutes, money, num, PAYMENT_LABEL, pct, SOURCE_LABEL, STATUS_LABEL, WEEKDAYS_SHORT, whatsappLink } from '@/lib/utils/format';

function ErrorBox({ error }: { error: unknown }) {
  return <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage(error)}</Card>;
}

const STATUS_CHART_COLOR: Record<string, string> = {
  SCHEDULED: CHART_COLORS[0],
  CONFIRMED: CHART_COLORS[2],
  IN_PROGRESS: CHART_COLORS[3],
  COMPLETED: CHART_COLORS[5],
  CANCELLED: CHART_COLORS[7],
  NO_SHOW: CHART_COLORS[4],
};

// ---------------- Agendamentos ----------------
export function AppointmentsTab({ period, canFilterPro }: { period: Period; canFilterPro: boolean }) {
  const [professionalId, setProfessionalId] = useState('');
  const pros = useQuery({ queryKey: ['professionals', 'lite'], queryFn: commissionsApi.professionals, enabled: canFilterPro });
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'appointments', period, professionalId], queryFn: () => reportsApi.appointments({ ...period, professionalId: professionalId || undefined }) });

  if (error) return <ErrorBox error={error} />;
  const total = data?.byStatus.reduce((s, r) => s + r.count, 0) ?? 0;
  const completed = data?.byStatus.find((s) => s.key === 'COMPLETED');
  const weekday = WEEKDAYS_SHORT.map((label, i) => ({ label, count: data?.byWeekday.find((w) => w.key === i)?.count ?? 0 }));
  const hours = (data?.byHour ?? []).map((h) => ({ label: `${String(h.key).padStart(2, '0')}h`, count: h.count }));

  return (
    <div className="space-y-4">
      {canFilterPro && (
        <div className="flex max-w-xs items-center gap-2">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Todos os profissionais</option>
            {pros.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Agendamentos" value={num(total)} />
            <StatCard label="Concluídos" value={num(completed?.count ?? 0)} hint={total ? pct(((completed?.count ?? 0) / total) * 100, 0) : undefined} />
            <StatCard label="Receita dos concluídos" value={money(completed?.revenue ?? 0)} />
            <StatCard label="Cancelados + faltas" value={num((data.byStatus.find((s) => s.key === 'CANCELLED')?.count ?? 0) + (data.byStatus.find((s) => s.key === 'NO_SHOW')?.count ?? 0))} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por dia da semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ColumnChart data={weekday} xKey="label" series={[{ key: 'count', name: 'Agendamentos' }]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por horário</CardTitle>
              </CardHeader>
              <CardContent>
                <ColumnChart data={hours} xKey="label" series={[{ key: 'count', name: 'Agendamentos' }]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por origem</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart formatter={(v) => num(v)} data={data.bySource.map((s) => ({ name: SOURCE_LABEL[s.key] ?? s.key, value: s.count }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por status</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart formatter={(v) => num(v)} data={data.byStatus.map((s) => ({ name: STATUS_LABEL[s.key] ?? s.key, value: s.count, color: STATUS_CHART_COLOR[s.key] }))} />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por profissional</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR>
                      <TH>Profissional</TH>
                      <TH className="text-right">Total</TH>
                      <TH className="text-right">Concluídos</TH>
                      <TH className="text-right">Cancel.</TH>
                      <TH className="text-right">Faltas</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.byProfessional
                      .filter((p) => p.total > 0)
                      .sort((a, b) => b.total - a.total)
                      .map((p) => (
                        <TR key={p.id}>
                          <TD>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color ?? '#9ca3af' }} />
                              {p.name}
                            </span>
                          </TD>
                          <TD className="text-right tabular-nums">{p.total}</TD>
                          <TD className="text-right tabular-nums">{p.completed}</TD>
                          <TD className="text-right tabular-nums">{p.cancelled}</TD>
                          <TD className="text-right tabular-nums">{p.noShow}</TD>
                        </TR>
                      ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clientes mais frequentes</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum atendimento concluído no período.</p>
                ) : (
                  <ul className="divide-y">
                    {data.topClients.map((c, i) => (
                      <li key={c.id ?? i} className="flex items-center gap-3 py-2 text-sm">
                        <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}º</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <Badge variant="secondary">{c.count} visita(s)</Badge>
                        {c.phone && (
                          <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700" title="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Financeiro ----------------
export function FinancialTab({ period }: { period: Period }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'financial', period], queryFn: () => reportsApi.financial(period) });
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <PageLoader />;
  const r = data.revenue;
  const e = data.expenses;
  const dre: { label: string; value: number; strong?: boolean; negative?: boolean }[] = [
    { label: 'Faturamento (comandas)', value: r.total, strong: true },
    { label: '(-) Custo dos produtos vendidos', value: -e.productsCost, negative: true },
    { label: '(-) Comissões', value: -e.commissions, negative: true },
    { label: '(-) Taxas de cartão', value: -e.cardFees, negative: true },
    { label: '= Lucro bruto', value: data.result.grossProfit, strong: true },
    { label: '(+) Outras receitas', value: r.otherIncome },
    { label: '(-) Despesas pagas', value: -e.total, negative: true },
    { label: '= Resultado líquido', value: data.result.netResult, strong: true },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Faturamento" value={money(r.total)} hint={`${num(r.orders)} comanda(s)`} />
        <StatCard label="Ticket médio" value={money(r.averageTicket)} />
        <StatCard label="Lucro bruto" value={money(data.result.grossProfit)} />
        <StatCard label="Resultado líquido" value={<span className={data.result.netResult < 0 ? 'text-red-600' : 'text-emerald-600'}>{money(data.result.netResult)}</span>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Receita por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={[
                { name: 'Serviços', value: r.services },
                { name: 'Produtos', value: r.products },
                { name: 'Pacotes', value: r.packages },
                { name: 'Avulsos', value: r.other },
              ].filter((x) => x.value > 0)}
            />
            {r.discounts > 0 && <p className="mt-3 text-xs text-muted-foreground">Descontos concedidos: {money(r.discounts)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList data={e.byCategory.map((c) => ({ name: c.category, value: c.amount }))} color={CHART_COLORS[7]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Demonstrativo (DRE simplificado)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {dre.map((d) => (
                <li key={d.label} className={d.strong ? 'flex justify-between border-t pt-1.5 font-semibold first:border-0 first:pt-0' : 'flex justify-between text-muted-foreground'}>
                  <span>{d.label}</span>
                  <span className={`tabular-nums ${d.strong && d.value < 0 ? 'text-red-600' : ''}`}>{money(d.value)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recebimentos por forma de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Forma</TH>
                <TH className="text-right">Bruto</TH>
                <TH className="text-right">Taxas</TH>
                <TH className="text-right">Líquido</TH>
              </TR>
            </THead>
            <TBody>
              {data.byMethod.map((m) => (
                <TR key={m.method}>
                  <TD>{PAYMENT_LABEL[m.method] ?? m.method}</TD>
                  <TD className="text-right tabular-nums">{money(m.amount)}</TD>
                  <TD className="text-right tabular-nums text-red-600">{m.fees ? money(-m.fees) : '-'}</TD>
                  <TD className="text-right font-medium tabular-nums">{money(m.net)}</TD>
                </TR>
              ))}
              {!data.byMethod.length && (
                <TR>
                  <TD colSpan={4} className="text-center text-muted-foreground">
                    Nenhum recebimento no período.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Ocupação ----------------
export function OccupancyTab({ period }: { period: Period }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'occupancy', period], queryFn: () => reportsApi.occupancy(period) });
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <PageLoader label="Calculando ocupação..." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Ocupação média" value={pct(data.average)} />
        <StatCard label="Horas disponíveis" value={minutes(data.professionals.reduce((s, p) => s + p.availableMin, 0))} />
        <StatCard label="Horas agendadas" value={minutes(data.professionals.reduce((s, p) => s + p.bookedMin, 0))} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Taxa de ocupação por profissional</CardTitle>
        </CardHeader>
        <CardContent>
          {data.professionals.length === 0 ? (
            <EmptyState title="Nenhum profissional ativo" />
          ) : (
            <ul className="space-y-4">
              {[...data.professionals]
                .sort((a, b) => b.occupancyPct - a.occupancyPct)
                .map((p) => (
                  <li key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color ?? '#9ca3af' }} />
                        {p.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {minutes(p.bookedMin)} de {minutes(p.availableMin)} · <b className="text-foreground">{pct(p.occupancyPct)}</b>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.occupancyPct)}%`, background: p.occupancyPct >= 80 ? '#059669' : p.occupancyPct >= 50 ? PRIMARY : '#9ca3af' }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Ocupação = minutos agendados ÷ minutos de jornada (descontando bloqueios e folgas).</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Retorno ----------------
export function RetentionTab({ period }: { period: Period }) {
  const [windowDays, setWindowDays] = useState(45);
  const [draft, setDraft] = useState('45');
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'retention', period, windowDays], queryFn: () => reportsApi.retention({ ...period, windowDays }) });
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(draft);
          if (n >= 1 && n <= 365) setWindowDays(n);
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Janela de retorno (dias)</Label>
          <Input type="number" min={1} max={365} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-32" />
        </div>
        <Button type="submit" variant="outline">
          Recalcular
        </Button>
        <div className="flex gap-1">
          {[30, 45, 60, 90].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={windowDays === d ? 'default' : 'ghost'}
              onClick={() => {
                setDraft(String(d));
                setWindowDays(d);
              }}
            >
              {d}d
            </Button>
          ))}
        </div>
      </form>
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Taxa de retorno" value={pct(data.returnRatePct)} hint={`voltaram em até ${data.windowDays} dias`} />
            <StatCard label="Clientes atendidos" value={num(data.clients)} />
            <StatCard label="Retornaram" value={num(data.returned)} />
            <StatCard label="Clientes inativos" value={num(data.inactiveClients)} hint={`sem visita há +${data.windowDays} dias`} />
          </div>
          <Card className="p-5">
            <div className="mb-2 flex justify-between text-sm">
              <span>Retornaram</span>
              <span className="font-medium">
                {num(data.returned)} de {num(data.clients)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, data.returnRatePct)}%` }} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Dica: crie uma campanha para os {num(data.inactiveClients)} clientes inativos em <Link to="/app/campanhas" className="font-medium text-primary hover:underline">Campanhas</Link> usando o filtro "inativos há X dias".
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------- Ticket médio ----------------
export function AverageTicketTab({ period }: { period: Period }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'average-ticket', period], queryFn: () => reportsApi.averageTicket(period) });
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ticket por comanda" value={money(data.perOrder)} />
        <StatCard label="Ticket por cliente" value={money(data.perClient)} />
        <StatCard label="Comandas" value={num(data.orders)} />
        <StatCard label="Clientes únicos" value={num(data.clients)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket médio por profissional</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList data={[...data.byProfessional].sort((a, b) => b.average - a.average).map((p) => ({ name: p.name, value: p.average, count: p.count }))} sub={(d) => `${num(d.count)} comanda(s)`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Profissional</TH>
                  <TH className="text-right">Comandas</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Ticket</TH>
                </TR>
              </THead>
              <TBody>
                {data.byProfessional.map((p) => (
                  <TR key={p.id}>
                    <TD>{p.name}</TD>
                    <TD className="text-right tabular-nums">{p.count}</TD>
                    <TD className="text-right tabular-nums">{money(p.total)}</TD>
                    <TD className="text-right font-medium tabular-nums">{money(p.average)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------- Movimentações ----------------
export function MovementsTab({ period }: { period: Period }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', 'movements', period], queryFn: () => reportsApi.movements(period) });
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <PageLoader />;
  const total = data.reduce((s, o) => s + Number(o.total), 0);

  const exportOrders = () => {
    downloadCSV(
      `movimentacoes_${period.from}_${period.to}`,
      ['Comanda', 'Tipo', 'Fechada em', 'Cliente', 'Telefone', 'Profissional', 'Subtotal', 'Desconto', 'Total', 'Taxas', 'Pagamentos'],
      data.map((o) => [
        o.number,
        o.kind === 'CLIENT' ? 'Cliente' : 'Consumo profissional',
        fmtDateTime(o.closedAt),
        o.client?.name ?? '',
        o.client?.phone ?? '',
        o.professional?.name ?? '',
        Number(o.subtotal),
        Number(o.discountAmount),
        Number(o.total),
        Number(o.feesTotal),
        o.payments.map((p) => `${PAYMENT_LABEL[p.method] ?? p.method}: ${Number(p.amount).toFixed(2).replace('.', ',')}`).join(' | '),
      ]),
    );
  };
  const exportItems = () => {
    downloadCSV(
      `itens_${period.from}_${period.to}`,
      ['Comanda', 'Fechada em', 'Cliente', 'Tipo', 'Descrição', 'Profissional', 'Qtd', 'Unitário', 'Total', 'Comissão'],
      data.flatMap((o) => o.items.map((i) => [o.number, fmtDateTime(o.closedAt), o.client?.name ?? '', i.type, i.description, i.professional?.name ?? '', Number(i.quantity), Number(i.unitPrice), Number(i.total), Number(i.commissionAmount)])),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {data.length} comanda(s) · <b className="text-foreground">{money(total)}</b>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportOrders} disabled={!data.length}>
            <Download /> Exportar comandas (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={exportItems} disabled={!data.length}>
            <Download /> Exportar itens (CSV)
          </Button>
        </div>
      </div>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Nº</TH>
              <TH>Fechada em</TH>
              <TH>Cliente</TH>
              <TH className="hidden md:table-cell">Itens</TH>
              <TH className="hidden lg:table-cell">Pagamento</TH>
              <TH className="text-right">Total</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((o) => (
              <TR key={o.id}>
                <TD>
                  <Link to={`/app/comandas/${o.id}`} className="font-medium text-primary hover:underline">
                    #{o.number}
                  </Link>
                  {o.kind !== 'CLIENT' && (
                    <Badge variant="outline" className="ml-2">
                      Consumo
                    </Badge>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(o.closedAt)}</TD>
                <TD>{o.client?.name ?? '-'}</TD>
                <TD className="hidden max-w-xs truncate text-muted-foreground md:table-cell">{o.items.map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.description}` : i.description)).join(', ')}</TD>
                <TD className="hidden text-muted-foreground lg:table-cell">{[...new Set(o.payments.map((p) => PAYMENT_LABEL[p.method] ?? p.method))].join(', ') || '-'}</TD>
                <TD className="text-right font-medium tabular-nums">{money(o.total)}</TD>
              </TR>
            ))}
            {!data.length && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma comanda fechada no período.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
