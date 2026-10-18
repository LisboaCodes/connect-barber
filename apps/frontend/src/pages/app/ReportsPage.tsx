import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { PeriodPicker, usePeriod } from '@/components/reports/PeriodPicker';
import { AppointmentsTab, AverageTicketTab, FinancialTab, MovementsTab, OccupancyTab, RetentionTab } from '@/components/reports/ReportTabs';
import { useAuthStore } from '@/store/auth.store';

const TABS = [
  { key: 'agendamentos', label: 'Agendamentos', managers: false },
  { key: 'financeiro', label: 'Financeiro', managers: true },
  { key: 'ocupacao', label: 'Ocupação', managers: true },
  { key: 'retorno', label: 'Retorno', managers: true },
  { key: 'ticket', label: 'Ticket médio', managers: true },
  { key: 'movimentacoes', label: 'Movimentações', managers: true },
];

export default function ReportsPage() {
  const role = useAuthStore((s) => s.current?.role);
  const isManager = role === 'OWNER' || role === 'ADMIN';
  const [period, setPeriod] = usePeriod('month');
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((t) => isManager || !t.managers);
  const tab = tabs.some((t) => t.key === params.get('aba')) ? params.get('aba')! : 'agendamentos';
  const p = { from: period.from, to: period.to };

  return (
    <div>
      <PageHeader title="Relatórios" description="Indicadores de agenda, financeiro, ocupação e fidelização." actions={<PeriodPicker value={period} onChange={setPeriod} presets={['today', 'week', 'month', 'last30', 'lastMonth']} />} />
      <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="agendamentos">
          <AppointmentsTab period={p} canFilterPro={role !== 'PROFESSIONAL'} />
        </TabsContent>
        {isManager && (
          <>
            <TabsContent value="financeiro">
              <FinancialTab period={p} />
            </TabsContent>
            <TabsContent value="ocupacao">
              <OccupancyTab period={p} />
            </TabsContent>
            <TabsContent value="retorno">
              <RetentionTab period={p} />
            </TabsContent>
            <TabsContent value="ticket">
              <AverageTicketTab period={p} />
            </TabsContent>
            <TabsContent value="movimentacoes">
              <MovementsTab period={p} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
