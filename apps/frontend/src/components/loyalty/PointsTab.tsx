import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Medal, SlidersHorizontal, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogFooter, EmptyState, Field, Input, Select, Skeleton, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { ClientSearch } from './ClientSearch';
import { errorMessage } from '@/lib/api/client';
import { loyaltyApi, type ClientLite } from '@/lib/api/loyalty';
import { fmtDateTime, fmtPhone, num } from '@/lib/utils/format';

const TX_LABEL: Record<string, string> = { EARN: 'Ganho', REDEEM: 'Resgate', ADJUST: 'Ajuste', EXPIRE: 'Expirado' };

export function PointsTab() {
  const qc = useQueryClient();
  const [client, setClient] = useState<ClientLite | null>(null);
  const [txStatus, setTxStatus] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjClient, setAdjClient] = useState<ClientLite | null>(null);
  const [points, setPoints] = useState('');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [description, setDescription] = useState('');

  const ranking = useQuery({ queryKey: ['loyalty', 'ranking'], queryFn: loyaltyApi.ranking });
  const requested = useQuery({ queryKey: ['loyalty', 'transactions', { status: 'REQUESTED' }], queryFn: () => loyaltyApi.transactions({ status: 'REQUESTED' }) });
  const txs = useQuery({ queryKey: ['loyalty', 'transactions', { clientId: client?.id, status: txStatus }], queryFn: () => loyaltyApi.transactions({ clientId: client?.id, status: txStatus || undefined, limit: 100 }) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['loyalty'] });
  const decide = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) => (ok ? loyaltyApi.confirm(id) : loyaltyApi.cancel(id)),
    onSuccess: (_d, v) => {
      toast.success(v.ok ? 'Resgate confirmado' : 'Resgate cancelado e pontos devolvidos');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const adjust = useMutation({
    mutationFn: () => loyaltyApi.adjust(adjClient!.id, { points: (mode === 'remove' ? -1 : 1) * Math.abs(Number(points)), description: description || undefined }),
    onSuccess: () => {
      toast.success('Pontos ajustados');
      invalidate();
      qc.invalidateQueries({ queryKey: ['clients'] });
      setAdjustOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openAdjust = (c?: ClientLite) => {
    setAdjClient(c ?? null);
    setPoints('');
    setMode('add');
    setDescription('');
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-4">
      {!!requested.data?.length && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-amber-900">Resgates aguardando confirmação ({requested.data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-amber-200">
              {requested.data.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.reward?.name ?? t.description} · {num(Math.abs(t.points))} pts · {fmtDateTime(t.createdAt)}
                    </div>
                  </div>
                  <Button size="sm" variant="success" loading={decide.isPending && decide.variables?.id === t.id && decide.variables.ok} onClick={() => decide.mutate({ id: t.id, ok: true })}>
                    <Check /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: t.id, ok: false })}>
                    <X /> Recusar
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Ranking de pontos</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openAdjust()}>
              <SlidersHorizontal /> Ajustar pontos
            </Button>
          </CardHeader>
          <CardContent>
            {ranking.isLoading ? (
              <Skeleton className="h-40" />
            ) : !ranking.data?.length ? (
              <EmptyState icon={Medal} title="Nenhum cliente com pontos" />
            ) : (
              <ul className="max-h-[480px] divide-y overflow-y-auto scrollbar-thin">
                {ranking.data.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                    <button type="button" className="min-w-0 flex-1 text-left hover:underline" onClick={() => setClient({ id: c.id, name: c.name, phone: c.phone, loyaltyPoints: c.loyaltyPoints })}>
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtPhone(c.phone)} · {c.visitsCount} visita(s)
                      </div>
                    </button>
                    <Badge variant="warning" className="tabular-nums">
                      {num(c.loyaltyPoints)} pts
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Extrato de pontos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <ClientSearch value={client} onChange={setClient} placeholder="Filtrar por cliente" />
              </div>
              <Select value={txStatus} onChange={(e) => setTxStatus(e.target.value)} className="sm:w-44">
                <option value="">Todos</option>
                <option value="DONE">Concluídos</option>
                <option value="REQUESTED">Resgates pendentes</option>
                <option value="CANCELLED">Cancelados</option>
              </Select>
              {client && (
                <Button variant="outline" onClick={() => openAdjust(client)}>
                  Ajustar
                </Button>
              )}
            </div>
            {txs.isLoading ? (
              <Skeleton className="h-40" />
            ) : !txs.data?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    {!client && <TH>Cliente</TH>}
                    <TH>Movimento</TH>
                    <TH className="text-right">Pontos</TH>
                    <TH className="text-right">Saldo</TH>
                  </TR>
                </THead>
                <TBody>
                  {txs.data.map((t) => (
                    <TR key={t.id} className={t.status === 'CANCELLED' ? 'opacity-50' : ''}>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(t.createdAt)}</TD>
                      {!client && <TD>{t.client.name}</TD>}
                      <TD>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TX_LABEL[t.type] ?? t.type}</Badge>
                          {t.status === 'REQUESTED' && <Badge variant="warning">Aguardando</Badge>}
                          {t.status === 'CANCELLED' && <Badge variant="secondary">Cancelado</Badge>}
                        </div>
                        {t.description && <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>}
                      </TD>
                      <TD className={`text-right font-medium tabular-nums ${t.points < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.points > 0 ? '+' : ''}
                        {num(t.points)}
                      </TD>
                      <TD className="text-right tabular-nums">{num(t.balanceAfter)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent size="sm" title="Ajustar pontos" description="Adicione ou remova pontos manualmente.">
          <div className="space-y-4">
            <Field label="Cliente" required>
              <ClientSearch value={adjClient} onChange={setAdjClient} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Operação">
                <Select value={mode} onChange={(e) => setMode(e.target.value as 'add' | 'remove')}>
                  <option value="add">Adicionar</option>
                  <option value="remove">Remover</option>
                </Select>
              </Field>
              <Field label="Pontos" required>
                <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
              </Field>
            </div>
            <Field label="Motivo">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Ex.: bonificação, correção..." />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancelar
            </Button>
            <Button loading={adjust.isPending} disabled={!adjClient || !Number(points)} onClick={() => adjust.mutate()}>
              Salvar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
