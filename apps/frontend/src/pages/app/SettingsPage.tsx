import { useSearchParams } from 'react-router-dom';
import { Building2, CalendarClock, Clock, CreditCard, MessageSquareText, Settings, Users } from 'lucide-react';
import { Button, EmptyState, PageHeader, PageLoader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { BusinessInfoForm } from '@/components/settings/BusinessInfoForm';
import { OpeningHoursForm } from '@/components/settings/OpeningHoursForm';
import { BookingSettingsForm } from '@/components/settings/BookingSettingsForm';
import { MessagesSettingsForm } from '@/components/settings/MessagesSettingsForm';
import { TeamSettings } from '@/components/settings/TeamSettings';
import { PaymentMethodsSettings } from '@/components/settings/PaymentMethodsSettings';
import { errorMessage } from '@/lib/api/client';
import { useTenant } from '@/lib/api/tenant';

const TABS = [
  { value: 'dados', label: 'Dados da barbearia', icon: Building2 },
  { value: 'horario', label: 'Horário de funcionamento', icon: Clock },
  { value: 'agendamento', label: 'Agendamento online', icon: CalendarClock },
  { value: 'mensagens', label: 'Mensagens automáticas', icon: MessageSquareText },
  { value: 'equipe', label: 'Equipe e acessos', icon: Users },
  { value: 'pagamentos', label: 'Formas de pagamento', icon: CreditCard },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'dados';
  const { data: tenant, isLoading, error, refetch } = useTenant();

  return (
    <div>
      <PageHeader title="Configurações" description="Dados, horários, regras de agendamento, mensagens, equipe e pagamentos" />
      {isLoading ? (
        <PageLoader />
      ) : error || !tenant ? (
        <EmptyState icon={Settings} title="Não foi possível carregar as configurações" description={errorMessage(error)} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList className="mb-2 h-auto flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="max-w-4xl">
            <TabsContent value="dados">
              <BusinessInfoForm tenant={tenant} />
            </TabsContent>
            <TabsContent value="horario">
              <OpeningHoursForm tenant={tenant} />
            </TabsContent>
            <TabsContent value="agendamento">
              <BookingSettingsForm tenant={tenant} />
            </TabsContent>
            <TabsContent value="mensagens">
              <MessagesSettingsForm tenant={tenant} />
            </TabsContent>
            <TabsContent value="equipe">
              <TeamSettings />
            </TabsContent>
            <TabsContent value="pagamentos">
              <PaymentMethodsSettings />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
