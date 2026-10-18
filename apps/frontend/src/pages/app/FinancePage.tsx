import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { EntriesTab } from '@/components/finance/EntriesTab';
import { CashflowTab } from '@/components/finance/CashflowTab';
import { CategoriesTab } from '@/components/finance/CategoriesTab';
import { financeApi } from '@/lib/api/finance';

const TABS = ['pagar', 'receber', 'fluxo', 'categorias'];

export default function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('aba') ?? '') ? params.get('aba')! : 'pagar';
  const { data: categories = [] } = useQuery({ queryKey: ['finance', 'categories'], queryFn: financeApi.categories });

  return (
    <div>
      <PageHeader title="Financeiro" description="Contas a pagar e a receber, fluxo de caixa e categorias." />
      <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>
        <TabsContent value="pagar">
          <EntriesTab type="EXPENSE" categories={categories} />
        </TabsContent>
        <TabsContent value="receber">
          <EntriesTab type="INCOME" categories={categories} />
        </TabsContent>
        <TabsContent value="fluxo">
          <CashflowTab />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriesTab categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
