import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, DollarSign, Receipt, TrendingUp, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Skeleton, StatCard } from '@/components/ui';
import OnboardingBanner from '@/components/app/OnboardingBanner';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { colorAt, DonutChart, HBarList, TimeAreaChart } from '@/components/reports/charts';
import { BirthdaysToday, DashboardAlerts, TodayAgenda } from '@/components/dashboard/DashboardWidgets';
import { reportsApi } from '@/lib/api/reports';
import { errorMessage } from '@/lib/api/client';
import { fmtDate, money, num, PAYMENT_LABEL, pct } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const current = useAuthStore((s) => s.current);
  const user = useAuthStore((s) => s.user);
  const role = current?.role;
  const isPro = role === 'PROFESSIONAL';
  const isManager = role === 'OWNER' || role === 'ADMIN';
  const [period, setPeriod] = usePeriod('month');

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'dashboard', period.from, period.to],
    queryFn: () => reportsApi.dashboard({ from: period.from, to: period.to }),
  });

  const k = data?.kpis;
  const firstName = user?.name?.split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      <OnboardingBanner />
      <PageHeader title={`${greet}${firstName ? `, ${firstName}` : ''}!`} description={isPro ? 'Seu desempenho e sua agenda.' : `Visão geral da ${current?.tenant.name ?? 'barbearia'}.`} actions={<PeriodPicker value={period} onChange={setPeriod} />} className="mb-0" />

      {error && <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage(error)}</Card>}

      {isLoading || !data || !k ? (
        <DashboardSkeleton />
      ) : (
        <>
          <DashboardAlerts kpis={k} showFinance={!isPro} isManager={isManager} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={isPro ? 'Meu faturamento' : 'Faturamento'} value={money(k.revenue)} icon={DollarSign} trend={isPro ? undefined : k.revenueChangePct} hint={isPro ? undefined : k.revenueChangePct === null ? 'sem base anterior' : 'vs. período anterior'} />
            <StatCard label="Comandas fechadas" value={num(k.ordersCount)} icon={Receipt} hint={!isPro && k.discounts > 0 ? `${money(k.discounts)} em descontos` : undefined} />
            <StatCard label="Ticket médio" value={money(k.averageTicket)} icon={TrendingUp} hint={!isPro && k.cardFees > 0 ? `${money(k.cardFees)} em taxas` : undefined} />
            <StatCard label="Novos clientes" value={num(k.newClients)} icon={UserPlus} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Agendamentos" value={num(k.appointments)} icon={CalendarCheck} />
            <StatCard label="Concluídos" value={num(k.completed)} hint={k.appointments ? pct((k.completed / k.appointments) * 100, 0) : undefined} />
            <StatCard label="Cancelados" value={num(k.cancelled)} hint={k.appointments ? pct((k.cancelled / k.appointments) * 100, 0) : undefined} />
            <StatCard label="Faltas" value={num(k.noShow)} hint={<span className={k.noShowRatePct > 10 ? 'font-medium text-red-600' : ''}>{pct(k.noShowRatePct)} de não comparecimento</span>} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Faturamento diário</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeAreaChart data={data.daily} xKey="day" series={[{ key: 'total', name: 'Faturamento' }]} xFormatter={(d: string) => fmtDate(d + 'T12:00:00', 'dd/MM')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vendas por forma de pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={data.byMethod.filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount).map((m) => ({ name: PAYMENT_LABEL[m.method] ?? m.method, value: m.amount }))} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Serviços mais vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarList data={data.topServices.map((s) => ({ name: s.name, value: s.total, quantity: s.quantity }))} sub={(d) => `${num(d.quantity)} realizado(s)`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Produtos mais vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarList data={data.topProducts.map((s) => ({ name: s.name, value: s.total, quantity: s.quantity }))} color={colorAt(0)} sub={(d) => `${num(d.quantity)} unidade(s)`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{isPro ? 'Minha produção' : 'Ranking por profissional'}</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarList data={data.byProfessional.map((p) => ({ name: p.name, value: p.total, color: p.color, commission: p.commission, items: p.items }))} sub={(d) => `${num(d.items)} item(ns) · comissão ${money(d.commission)}`} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TodayAgenda items={data.todayAppointments} />
            </div>
            <BirthdaysToday items={data.birthdaysToday} shopName={current?.tenant.name} />
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
