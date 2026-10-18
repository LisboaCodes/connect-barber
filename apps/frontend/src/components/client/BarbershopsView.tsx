import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Crown, Gift, Package, Store, XCircle } from 'lucide-react';
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui';
import { fmtDate, num } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { clientAreaApi } from '@/lib/api/clientArea';
import { ShopLogo } from '@/components/public/shared';

export default function BarbershopsView() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ['me-barbershops'], queryFn: clientAreaApi.barbershops });

  if (isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );

  if (isError)
    return (
      <EmptyState
        icon={XCircle}
        title="Não foi possível carregar"
        description={errorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Minhas barbearias</h1>
        <p className="text-sm text-muted-foreground">Pontos de fidelidade, pacotes e clubes em cada barbearia.</p>
      </div>
      {data.length === 0 ? (
        <EmptyState icon={Store} className="bg-white" title="Nenhuma barbearia vinculada" description="Quando você agendar em uma barbearia do Connect Barber com este e-mail ou telefone, ela aparecerá aqui." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((b) => {
            const nextReward = b.program?.rewards.find((r) => r.pointsCost > b.loyaltyPoints);
            return (
              <div key={b.clientId} className="flex flex-col rounded-xl border bg-white p-4">
                <div className="flex items-center gap-3">
                  <ShopLogo name={b.tenant.name} logoUrl={b.tenant.logoUrl} className="h-12 w-12 text-sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/b/${b.tenant.slug}`} className="block truncate font-semibold hover:underline">
                      {b.tenant.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {b.visitsCount} visita(s){b.lastVisitAt ? ` · última em ${fmtDate(b.lastVisitAt)}` : ''}
                    </div>
                  </div>
                </div>

                {b.program && (
                  <div className="mt-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                        <Gift className="h-3.5 w-3.5" /> {b.program.name}
                      </span>
                      <span className="text-lg font-bold text-amber-900">{num(b.loyaltyPoints)} pts</span>
                    </div>
                    {nextReward && (
                      <>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (b.loyaltyPoints / nextReward.pointsCost) * 100)}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-amber-900/80">
                          Faltam {num(nextReward.pointsCost - b.loyaltyPoints)} pts para {nextReward.name}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.club && (
                    <Badge variant="warning" className="gap-1">
                      <Crown className="h-3 w-3" /> {b.club.name}
                      {Number(b.club.discountPct) > 0 && ` · ${num(b.club.discountPct)}% off`}
                    </Badge>
                  )}
                  {b.packages.map((p) => {
                    const left = p.items.reduce((t, i) => t + (i.totalQty - i.usedQty), 0);
                    return (
                      <Badge key={p.id} variant="secondary" className="gap-1">
                        <Package className="h-3 w-3" /> {p.package.name} · {left} restante(s)
                        {p.expiresAt && ` · até ${fmtDate(p.expiresAt)}`}
                      </Badge>
                    );
                  })}
                </div>

                <div className="mt-auto flex gap-2 pt-4">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/b/${b.tenant.slug}/agendar`}>
                      <CalendarPlus /> Agendar
                    </Link>
                  </Button>
                  {b.program && (
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to={`/cliente/fidelidade/${b.clientId}`}>
                        <Gift /> Ver fidelidade
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
