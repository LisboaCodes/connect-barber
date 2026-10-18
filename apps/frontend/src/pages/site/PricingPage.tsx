import { Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { PricingTable } from '@/components/site/PricingTable';
import { CTA, FAQ } from '@/components/site/sections';

const INCLUDED = [
  'Agenda on-line 24h e site da barbearia',
  'Lembretes automáticos por WhatsApp e e-mail',
  'Comandas, caixa e gestão financeira',
  'Comissões, vales e consumo dos profissionais',
  'Gestão de estoque e produtos',
  'Pacotes de serviços e produtos',
  'Programa de fidelidade e clube de clientes',
  'Notícias e promoções por WhatsApp e e-mail',
  'Aniversariantes e mensagens de retorno',
  'Lista de espera e pesquisa de satisfação',
  'Relatórios gerenciais',
  'Pagamento on-line',
  'Acesso para equipe com permissões',
  'Suporte por WhatsApp',
];

const BILLING_FAQ = [
  { q: 'Preciso cadastrar cartão de crédito para testar?', a: 'Não. O teste grátis de 30 dias não exige cartão. Ao final do período você escolhe o plano e gera a fatura pelo próprio painel.' },
  { q: 'Como o plano é definido?', a: 'Pelo número de profissionais ativos na barbearia. Todas as funcionalidades estão disponíveis em todos os planos.' },
  { q: 'Posso trocar de plano depois?', a: 'Sim. Você pode fazer upgrade ou downgrade a cada vencimento da fatura mensal, conforme sua equipe cresce ou diminui.' },
  { q: 'Quais as formas de pagamento?', a: 'Pix, cartão de crédito ou boleto, pelo link de pagamento gerado no painel em Meu plano.' },
  { q: 'Existe fidelidade ou multa de cancelamento?', a: 'Não. A cobrança é mensal e você pode cancelar quando quiser, sem multa.' },
  { q: 'O que acontece se a fatura atrasar?', a: 'Você recebe avisos por e-mail. Após 7 dias de atraso o acesso ao painel é suspenso até a regularização; seus dados continuam guardados.' },
];

export default function PricingPage() {
  return (
    <div>
      <section className="bg-gray-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">30% OFF no lançamento</span>
          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">Preços simples e transparentes</h1>
          <p className="mt-4 text-lg text-gray-300">Comece com 30 dias grátis. Depois, pague apenas pelo tamanho da sua equipe.</p>
        </div>
      </section>

      <section className="pb-6">
        <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
          <PricingTable />
          <p className="mt-6 text-center text-xs text-muted-foreground">* Valor total equivalente a 12 meses no preço promocional. Cobrança mensal, sem fidelidade.</p>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Card className="p-8">
            <h2 className="text-2xl font-bold">Tudo incluso em todos os planos</h2>
            <p className="mt-1 text-muted-foreground">Não existe plano "básico" ou "premium": só muda o número de profissionais.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {INCLUDED.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <FAQ items={BILLING_FAQ} title="Dúvidas sobre cobrança" />
      <CTA />
    </div>
  );
}
