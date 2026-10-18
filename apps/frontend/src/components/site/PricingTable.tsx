import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { billingApi } from '@/lib/api/billing';
import { money } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function PricingTable({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['public-plans'], queryFn: billingApi.plans });
  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {(data ?? []).map((p) => {
        const highlight = p.code === 'P2_5';
        return (
          <Card key={p.code} className={cn('relative flex flex-col p-6', highlight && 'border-primary shadow-lg ring-1 ring-primary')}>
            <Badge className="absolute -top-3 left-5" variant={highlight ? 'default' : 'secondary'}>
              30% OFF
            </Badge>
            {highlight && <span className="absolute -top-3 right-5 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">Mais escolhido</span>}
            <div className="text-sm font-semibold text-muted-foreground">{p.name}</div>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-3xl font-bold">{money(p.promoPrice)}</span>
              <span className="mb-1 text-sm text-muted-foreground">/mês</span>
            </div>
            <div className="text-sm text-muted-foreground line-through">{money(p.monthlyPrice)}/mês</div>
            <div className="mt-1 text-xs text-muted-foreground">Valor total: {money(p.promoPrice * 12)}*</div>
            {!compact && (
              <ul className="mt-5 space-y-2 text-sm">
                {[p.description, 'Todas as funcionalidades', 'Agenda e site on-line', 'Suporte por WhatsApp'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
            )}
            <Button className="mt-6 w-full" variant={highlight ? 'default' : 'outline'} asChild>
              <Link to="/cadastro">Testar grátis por 30 dias</Link>
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
