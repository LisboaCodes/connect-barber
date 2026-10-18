import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Gift, History, XCircle } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtDateTime, money, num } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { clientAreaApi, type LoyaltyReward, type MyBarbershop } from '@/lib/api/clientArea';
import { ShopLogo } from '@/components/public/shared';

const TX_LABEL: Record<string, string> = { EARN: 'Ganho', REDEEM: 'Resgate', ADJUST: 'Ajuste', EXPIRE: 'Expirado' };
const TX_STATUS: Record<string, { label: string; variant: 'warning' | 'destructive' }> = {
  REQUESTED: { label: 'Aguardando retirada', variant: 'warning' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

export default function LoyaltyView() {
  const { clientId = '' } = useParams();
  const qc = useQueryClient();
  const [reward, setReward] = useState<LoyaltyReward | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['me-loyalty', clientId], queryFn: () => clientAreaApi.loyalty(clientId), enabled: !!clientId });
  // nome da barbearia (reaproveita a lista, se já carregada)
  const shops = useQuery({ queryKey: ['me-barbershops'], queryFn: clientAreaApi.barbershops });
  const shop: MyBarbershop | undefined = shops.data?.find((b) => b.clientId === clientId);

  const redeem = useMutation({
    mutationFn: (r: LoyaltyReward) => clientAreaApi.redeem(clientId, r.id),
    onSuccess: () => {
      toast.success('Resgate solicitado! Retire seu prêmio na barbearia.');
      setReward(null);
      qc.invalidateQueries({ queryKey: ['me-loyalty', clientId] });
      qc.invalidateQueries({ queryKey: ['me-barbershops'] });
    },
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível resgatar')),
  });

  const back = (
    <Link to="/cliente/barbearias" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" /> Minhas barbearias
    </Link>
  );

  if (isLoading)
    return (
      <div className="space-y-3">
        {back}
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );

  if (isError || !data)
    return (
      <div>
        {back}
        <EmptyState
          icon={XCircle}
          title="Não foi possível carregar a fidelidade"
          description={errorMessage(error)}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );

  const program = data.program?.isActive ? data.program : null;
  const rewards = program?.rewards ?? [];

  return (
    <div>
      {back}
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 text-white">
        <div className="flex items-center gap-3">
          {shop && <ShopLogo name={shop.tenant.name} logoUrl={shop.tenant.logoUrl} className="h-10 w-10 text-xs" />}
          <div>
            <div className="text-sm text-white/70">{shop?.tenant.name ?? 'Barbearia'}</div>
            <div className="font-semibold">{program?.name ?? 'Programa de fidelidade'}</div>
          </div>
        </div>
        <div className="mt-5 text-xs uppercase tracking-wider text-white/60">Seu saldo</div>
        <div className="text-4xl font-extrabold text-amber-400">
          {num(data.points)} <span className="text-lg font-semibold text-white/80">pontos</span>
        </div>
        {program && (
          <p className="mt-2 text-xs text-white/70">
            {program.description || `Você ganha ${num(program.pointsPerCurrency, 0)} ponto(s) a cada R$ 1,00.`}
            {program.pointsExpireDays ? ` Pontos expiram em ${program.pointsExpireDays} dias.` : ''}
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-6 flex items-center gap-2 font-semibold">
        <Gift className="h-4 w-4 text-amber-600" /> Prêmios
      </h2>
      {!program ? (
        <EmptyState className="bg-white" title="Programa de fidelidade inativo" description="Esta barbearia não está com o programa ativo no momento." />
      ) : rewards.length === 0 ? (
        <EmptyState className="bg-white" title="Nenhum prêmio cadastrado" description="Continue acumulando pontos — em breve haverá prêmios para resgatar." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rewards.map((r) => {
            const enough = data.points >= r.pointsCost;
            return (
              <div key={r.id} className={cn('flex items-center gap-3 rounded-xl border bg-white p-4', !enough && 'opacity-80')}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {num(r.pointsCost)} pts{r.discountAmount ? ` · ${money(r.discountAmount)} de desconto` : ''}
                  </div>
                  {!enough && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, (data.points / r.pointsCost) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <Button size="sm" disabled={!enough} onClick={() => setReward(r)}>
                  Resgatar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-6 flex items-center gap-2 font-semibold">
        <History className="h-4 w-4 text-amber-600" /> Extrato
      </h2>
      {data.transactions.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {data.transactions.map((t) => {
            const st = TX_STATUS[t.status];
            return (
              <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {t.description || t.reward?.name || TX_LABEL[t.type]}
                    {st && <Badge variant={st.variant}>{st.label}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {TX_LABEL[t.type]} · {fmtDateTime(t.createdAt)}
                  </div>
                </div>
                <div className={cn('whitespace-nowrap font-semibold', t.points >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {t.points >= 0 ? '+' : ''}
                  {num(t.points)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!reward}
        onOpenChange={(o) => !o && setReward(null)}
        title="Resgatar prêmio?"
        description={reward ? `${reward.name} por ${num(reward.pointsCost)} pontos. Os pontos serão reservados e você retira o prêmio na barbearia.` : undefined}
        confirmText="Confirmar resgate"
        loading={redeem.isPending}
        onConfirm={() => {
          if (reward) redeem.mutate(reward);
        }}
      />
    </div>
  );
}
