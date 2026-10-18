import { Link } from 'react-router-dom';
import { AlertTriangle, Cake, CalendarClock, ChevronRight, MessageCircle, Package, Receipt, Wallet } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtTime, money, STATUS_COLOR, STATUS_LABEL, whatsappLink } from '@/lib/utils/format';
import type { DashboardData } from '@/lib/api/reports';

type Kpis = DashboardData['kpis'];

export function DashboardAlerts({ kpis, showFinance, isManager }: { kpis: Kpis; showFinance: boolean; isManager: boolean }) {
  const alerts: { key: string; icon: React.ComponentType<{ className?: string }>; text: string; to: string; cta: string; tone: 'warning' | 'danger' | 'info' }[] = [];
  if (!kpis.cashierOpen && showFinance) alerts.push({ key: 'cashier', icon: Wallet, text: 'O caixa está fechado.', to: '/app/caixa', cta: 'Abrir caixa', tone: 'warning' });
  if (kpis.openOrders > 0) alerts.push({ key: 'orders', icon: Receipt, text: `${kpis.openOrders} comanda(s) em aberto.`, to: '/app/comandas', cta: 'Ver comandas', tone: 'info' });
  if (kpis.lowStockCount > 0 && showFinance) alerts.push({ key: 'stock', icon: Package, text: `${kpis.lowStockCount} produto(s) com estoque baixo.`, to: '/app/produtos', cta: 'Ver produtos', tone: 'warning' });
  if (kpis.pendingPayables > 0 && isManager) alerts.push({ key: 'payables', icon: AlertTriangle, text: `${money(kpis.pendingPayables)} em contas a pagar até o fim do período.`, to: '/app/financeiro', cta: 'Ver financeiro', tone: 'danger' });
  if (!alerts.length) return null;
  const tones = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {alerts.map((a) => (
        <Link key={a.key} to={a.to} className={cn('group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-shadow hover:shadow-sm', tones[a.tone])}>
          <a.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{a.text}</span>
          <span className="flex shrink-0 items-center text-xs font-semibold opacity-80 group-hover:opacity-100">
            {a.cta}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function TodayAgenda({ items }: { items: DashboardData['todayAppointments'] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Agenda de hoje
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/agenda">Abrir agenda</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nenhum agendamento hoje" description="Os horários marcados para hoje aparecem aqui." className="p-6" />
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="w-12 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.startAt)}</div>
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: a.professional?.color ?? '#9ca3af' }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.client?.name ?? a.guestName ?? 'Cliente sem cadastro'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.services.map((s) => s.service?.name).filter(Boolean).join(', ') || '-'} · {a.professional?.name}
                  </div>
                </div>
                <Badge className={cn('border', STATUS_COLOR[a.status])}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function BirthdaysToday({ items, shopName }: { items: DashboardData['birthdaysToday']; shopName?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" /> Aniversariantes de hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente faz aniversário hoje.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Avatar name={c.name} size="sm" color="#f59e0b" />
                <Link to={`/app/clientes/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {c.name}
                </Link>
                {c.phone && (
                  <Button asChild variant="outline" size="sm" className="h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <a href={whatsappLink(c.phone, `Feliz aniversário, ${c.name.split(' ')[0]}! 🎉 Toda a equipe${shopName ? ` da ${shopName}` : ''} deseja um dia incrível pra você.`)} target="_blank" rel="noreferrer">
                      <MessageCircle /> Parabenizar
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
