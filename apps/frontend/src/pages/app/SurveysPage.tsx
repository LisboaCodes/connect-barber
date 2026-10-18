import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareQuote, Settings, Star } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, PageLoader, Select, StatCard } from '@/components/ui';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { errorMessage } from '@/lib/api/client';
import { surveysApi } from '@/lib/api/surveys';
import { commissionsApi } from '@/lib/api/commissions';
import { cn } from '@/lib/utils/cn';
import { fmtDateTime, num, pct } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

const RATING_COLOR = ['#e34948', '#eb6834', '#eda100', '#1baf7a', '#008300'];

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
      ))}
    </span>
  );
}

export default function SurveysPage() {
  const role = useAuthStore((s) => s.current?.role);
  const isPro = role === 'PROFESSIONAL';
  const isManager = role === 'OWNER' || role === 'ADMIN';
  const [period, setPeriod] = usePeriod('last30');
  const [professionalId, setProfessionalId] = useState('');
  const [answered, setAnswered] = useState<'' | 'true' | 'false'>('true');
  const [onlyComments, setOnlyComments] = useState(false);

  const pros = useQuery({ queryKey: ['professionals', 'lite'], queryFn: commissionsApi.professionals, enabled: !isPro });
  const base = { from: period.from, to: period.to, professionalId: professionalId || undefined };
  // resumo geral (independe do filtro "respondidas") + lista filtrada
  const all = useQuery({ queryKey: ['surveys', { ...base, answered: '' }], queryFn: () => surveysApi.list({ ...base, answered: '' }) });
  const filtered = useQuery({ queryKey: ['surveys', { ...base, answered }], queryFn: () => surveysApi.list({ ...base, answered }), enabled: answered !== '' });
  const data = answered === '' ? all.data : filtered.data ?? all.data;
  const summary = all.data?.summary;
  const { isLoading, error } = all;

  const proName = useMemo(() => {
    const m = new Map<string, string>();
    pros.data?.forEach((p) => m.set(p.id, p.name));
    data?.items.forEach((i) => i.professional && m.set(i.professional.id, i.professional.name));
    return m;
  }, [pros.data, data]);

  const items = (data?.items ?? []).filter((i) => !onlyComments || i.comment);
  const maxDist = Math.max(1, ...(summary?.distribution.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisa de satisfação"
        description="Avaliações enviadas aos clientes após o atendimento."
        className="mb-0"
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} presets={['week', 'month', 'last30', 'lastMonth']} />
            {!isPro && (
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className="h-8 w-44 text-xs">
                <option value="">Todos os profissionais</option>
                {pros.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />

      {error ? (
        <Card className="p-4 text-sm text-red-700">{errorMessage(error)}</Card>
      ) : isLoading || !data || !summary ? (
        <PageLoader />
      ) : summary.sent === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="Nenhuma pesquisa enviada no período"
          description="Ative a pesquisa de satisfação em Configurações para enviar automaticamente uma avaliação ao cliente depois de cada atendimento concluído."
          action={
            isManager ? (
              <Button asChild>
                <Link to="/app/configuracoes">
                  <Settings /> Ir para Configurações
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Nota média" value={summary.average !== null ? <span className="flex items-center gap-2">{num(summary.average, 1)} <Stars value={summary.average} /></span> : '-'} />
            <StatCard label="Pesquisas enviadas" value={num(summary.sent)} />
            <StatCard label="Respondidas" value={num(summary.answered)} hint={summary.sent ? `${pct((summary.answered / summary.sent) * 100, 0)} de resposta` : undefined} />
            <StatCard label="Promotores (5★)" value={num(summary.distribution.find((d) => d.rating === 5)?.count ?? 0)} hint={summary.answered ? pct(((summary.distribution.find((d) => d.rating === 5)?.count ?? 0) / summary.answered) * 100, 0) : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição das notas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {[...summary.distribution].reverse().map((d) => (
                    <li key={d.rating} className="flex items-center gap-3 text-sm" title={`${d.rating} estrela(s): ${d.count}`}>
                      <span className="flex w-10 items-center gap-1 font-medium">
                        {d.rating} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(d.count / maxDist) * 100}%`, background: RATING_COLOR[d.rating - 1] }} />
                      </div>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">
                        {d.count} {summary.answered ? `(${num((d.count / summary.answered) * 100, 0)}%)` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Média por profissional</CardTitle>
              </CardHeader>
              <CardContent>
                {!summary.byProfessional.length ? (
                  <p className="text-sm text-muted-foreground">Sem respostas no período.</p>
                ) : (
                  <ul className="divide-y">
                    {[...summary.byProfessional]
                      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
                      .map((p) => (
                        <li key={p.professionalId ?? 'none'} className="flex items-center gap-3 py-2 text-sm">
                          <span className="flex-1 truncate">{(p.professionalId && proName.get(p.professionalId)) || 'Sem profissional'}</span>
                          {p.average !== null && <Stars value={p.average} size="h-3.5 w-3.5" />}
                          <span className="w-10 text-right font-semibold tabular-nums">{p.average !== null ? num(p.average, 1) : '-'}</span>
                          <span className="w-20 text-right text-xs text-muted-foreground">{p.count} resp.</span>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>Avaliações</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={answered} onChange={(e) => setAnswered(e.target.value as '' | 'true' | 'false')} className="h-8 w-40 text-xs">
                  <option value="true">Respondidas</option>
                  <option value="false">Sem resposta</option>
                  <option value="">Todas</option>
                </Select>
                <Button size="sm" variant={onlyComments ? 'default' : 'outline'} onClick={() => setOnlyComments((v) => !v)}>
                  Com comentário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!items.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma avaliação para os filtros escolhidos.</p>
              ) : (
                <ul className="divide-y">
                  {items.map((s) => (
                    <li key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                      <div className="w-full sm:w-48 sm:shrink-0">
                        <div className="font-medium">{s.client?.name ?? 'Cliente'}</div>
                        <div className="text-xs text-muted-foreground">{s.professional?.name ?? '-'}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {s.rating !== null ? <Stars value={s.rating} /> : <Badge variant="secondary">Aguardando resposta</Badge>}
                        {s.comment && <p className="mt-1 rounded-lg bg-muted/50 p-2 text-sm italic">“{s.comment}”</p>}
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">{fmtDateTime(s.answeredAt ?? s.sentAt ?? s.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {data.items.length >= 300 && <p className="mt-3 text-xs text-muted-foreground">Exibindo as 300 avaliações mais recentes. Reduza o período para ver as demais.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
