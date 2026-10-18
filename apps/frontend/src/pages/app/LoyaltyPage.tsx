import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { ProgramTab } from '@/components/loyalty/ProgramTab';
import { PointsTab } from '@/components/loyalty/PointsTab';
import { PackagesTab } from '@/components/loyalty/PackagesTab';
import { ClubsTab } from '@/components/loyalty/ClubsTab';
import { useIsManager } from '@/store/auth.store';

const TABS = ['programa', 'pontos', 'pacotes', 'clube'];

export default function LoyaltyPage() {
  const canManage = useIsManager();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('aba') ?? '') ? params.get('aba')! : 'programa';

  return (
    <div>
      <PageHeader title="Fidelidade" description="Programa de pontos, pacotes de serviços e clube de assinatura." />
      <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="programa">Programa</TabsTrigger>
          <TabsTrigger value="pontos">Pontos</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          <TabsTrigger value="clube">Clube</TabsTrigger>
        </TabsList>
        <TabsContent value="programa">
          <ProgramTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="pontos">
          <PointsTab />
        </TabsContent>
        <TabsContent value="pacotes">
          <PackagesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="clube">
          <ClubsTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
