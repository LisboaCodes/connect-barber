import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BarChart3,
  Boxes,
  Cake,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  Gift,
  Globe,
  MessageCircle,
  Megaphone,
  Package,
  Percent,
  Scissors,
  Star,
  Users,
  Wallet,
  Briefcase,
  UserRound,
  Smartphone,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface FeatureDef {
  key: string;
  title: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  paragraphs: string[];
  bullets?: string[];
}

export const FEATURES: FeatureDef[] = [
  {
    key: 'lembretes',
    title: 'Lembrete de horários',
    short: 'Menos faltas: o cliente recebe aviso automático por WhatsApp e e-mail antes do horário.',
    icon: Bell,
    color: 'bg-amber-100 text-amber-700',
    paragraphs: [
      'Diminua o risco de esquecimentos e ausências. Ao agendar, o cliente recebe a confirmação na hora e, no prazo que você configurar, um lembrete automático por WhatsApp e e-mail.',
      'Os textos das mensagens são personalizáveis com o nome do cliente, do profissional, data, hora e serviços.',
    ],
  },
  {
    key: 'jornada',
    title: 'Agenda flexível por profissional',
    short: 'Jornada por dia da semana, folgas, jornada estendida, encaixes e bloqueios.',
    icon: Clock,
    color: 'bg-sky-100 text-sky-700',
    paragraphs: [
      'Cada profissional tem a própria jornada por dia da semana, com mais de um intervalo por dia. O sistema impede agendamentos fora do expediente automaticamente.',
      'Vai atender fora do horário ou precisa de uma folga específica? Cadastre jornadas por data, bloqueie períodos e faça encaixes quando for preciso.',
    ],
  },
  {
    key: 'agenda-online',
    title: 'Agenda on-line 24 horas',
    short: 'Seu cliente agenda pelo site da barbearia a qualquer hora, sem precisar ligar.',
    icon: Globe,
    color: 'bg-emerald-100 text-emerald-700',
    paragraphs: [
      'Domingo de manhã, da palma da mão, o cliente escolhe serviço, profissional e horário entre os que estão realmente livres. A agenda vai se preenchendo sozinha.',
      'Você define antecedência mínima, limite de dias à frente, confirmação automática e política de cancelamento.',
    ],
  },
  {
    key: 'comandas',
    title: 'Comandas e controle de consumo',
    short: 'Todo agendamento vira uma comanda: serviços, produtos, descontos, parcelas e formas de pagamento.',
    icon: ClipboardList,
    color: 'bg-violet-100 text-violet-700',
    paragraphs: [
      'Cada atendimento gera uma comanda onde você adiciona outros serviços e produtos (a cerveja do bar inclusive). Consumiu só produtos? Abra uma comanda avulsa.',
      'Aplique descontos, parcele, escolha a forma de pagamento com as taxas configuradas e feche: estoque, comissão, caixa e pontos de fidelidade são lançados sozinhos.',
    ],
  },
  {
    key: 'financeiro',
    title: 'Gestão financeira',
    short: 'Caixa, contas a pagar e receber, fluxo de caixa e taxas de cartão sempre atualizados.',
    icon: CreditCard,
    color: 'bg-rose-100 text-rose-700',
    paragraphs: [
      'Controle a abertura e o fechamento do caixa com conferência de dinheiro, sangrias e suprimentos.',
      'Lance despesas e receitas, parcele contas, acompanhe o fluxo de caixa dia a dia e saiba o resultado real do mês com as taxas dos cartões descontadas.',
    ],
  },
  {
    key: 'relatorios',
    title: 'Relatórios gerenciais',
    short: 'Agendamentos por dia da semana e horário, ocupação, ticket médio, retorno e financeiro.',
    icon: BarChart3,
    color: 'bg-indigo-100 text-indigo-700',
    paragraphs: [
      'Transforme dados em decisão: descubra em quais dias e horários a agenda está vazia e crie uma promoção com desconto justamente para eles.',
      'Taxa de ocupação por profissional, ticket médio, taxa de retorno de clientes, faturamento por serviço, produto e forma de pagamento.',
    ],
  },
  {
    key: 'pacotes',
    title: 'Pacotes de serviços e produtos',
    short: 'Venda pacotes com validade e controle as sessões usadas de cada cliente.',
    icon: Package,
    color: 'bg-teal-100 text-teal-700',
    paragraphs: [
      'Pacotes antecipam receita e fidelizam. Monte combinações de serviços e produtos com preço especial e prazo de validade.',
      'O sistema controla quantas sessões o cliente comprou e quantas já usou, com total transparência na comanda.',
    ],
  },
  {
    key: 'estoque',
    title: 'Gestão de estoque',
    short: 'Saldo, custo, lucro por produto, alertas de estoque mínimo e validade.',
    icon: Boxes,
    color: 'bg-orange-100 text-orange-700',
    paragraphs: ['Barbearias movimentam produtos de bar e cosméticos para uso e venda. Controlar isso evita perdas e vencimentos.'],
    bullets: ['Saldo de cada produto e histórico de entradas e saídas', 'Custo e lucro por produto', 'Alerta de estoque baixo e de validade', 'Inventário com valor em estoque', 'Baixa automática na venda e no uso interno'],
  },
  {
    key: 'aniversariantes',
    title: 'Aniversariantes',
    short: 'Mensagem automática no dia e lista do mês para criar promoções especiais.',
    icon: Cake,
    color: 'bg-pink-100 text-pink-700',
    paragraphs: ['Quem não gosta de ser lembrado no aniversário? O Connect Barber avisa quem faz aniversário no dia e no mês e pode enviar automaticamente uma mensagem com sua promoção.'],
  },
  {
    key: 'lista-espera',
    title: 'Lista de espera',
    short: 'Agenda lotada? Quando vagar um horário, o cliente é avisado automaticamente.',
    icon: Users,
    color: 'bg-cyan-100 text-cyan-700',
    paragraphs: ['O cliente entra na lista do dia pelo site ou pela recepção. Se alguém cancelar, os primeiros da lista recebem o aviso na hora e agendam sozinhos, sem interromper seu atendimento.'],
  },
  {
    key: 'retorno',
    title: 'Mensagens de retorno automáticas',
    short: 'X dias após o serviço, o cliente recebe um convite para voltar.',
    icon: MessageCircle,
    color: 'bg-lime-100 text-lime-700',
    paragraphs: ['Manter um cliente custa até cinco vezes menos do que conquistar um novo. Configure, por serviço, quantos dias depois o cliente deve ser lembrado de voltar e deixe o sistema trabalhar.'],
  },
  {
    key: 'satisfacao',
    title: 'Pesquisa de satisfação',
    short: 'Após cada atendimento o cliente avalia o profissional de 1 a 5 estrelas.',
    icon: Star,
    color: 'bg-yellow-100 text-yellow-700',
    paragraphs: ['Medir a satisfação mantém a qualidade. Com a pesquisa ativada, o cliente recebe um link curto e você acompanha as notas e comentários por profissional.'],
  },
  {
    key: 'clube',
    title: 'Clube de clientes',
    short: 'Desconto automático para membros do clube em serviços e produtos.',
    icon: Percent,
    color: 'bg-fuchsia-100 text-fuchsia-700',
    paragraphs: ['Crie clubes de vantagens com percentual de desconto e mensalidade. O desconto é aplicado sozinho na comanda dos clientes membros.'],
  },
  {
    key: 'fidelidade',
    title: 'Programa de fidelidade',
    short: 'Pontos por real gasto, prêmios para resgate e extrato na área do cliente.',
    icon: Gift,
    color: 'bg-red-100 text-red-700',
    paragraphs: ['Funciona como milhas: o cliente acumula pontos a cada serviço ou produto e troca por prêmios que você define. Ele acompanha o extrato e pede o resgate pela área do cliente.'],
  },
  {
    key: 'site',
    title: 'Site do estabelecimento',
    short: 'Sua barbearia ganha um site com fotos, horários, serviços, equipe e agendamento.',
    icon: Globe,
    color: 'bg-blue-100 text-blue-700',
    paragraphs: ['Personalize com descrição, galeria, formas de pagamento, redes sociais, localização e equipe. Seus clientes encontram você no Google e agendam direto por lá.'],
  },
  {
    key: 'comissoes',
    title: 'Comissões, vales e consumo dos profissionais',
    short: 'Comissão por serviço e produto, vales e comandas de consumo com fechamento por período.',
    icon: Wallet,
    color: 'bg-stone-200 text-stone-700',
    paragraphs: ['Configure a comissão de cada profissional (e por serviço ou produto), lance vales e comandas de consumo, e feche o período com o relatório pronto para pagamento, claro e transparente.'],
  },
  {
    key: 'campanhas',
    title: 'Envio de notícias e promoções',
    short: 'Mande promoções por WhatsApp e e-mail para todos ou um grupo de clientes.',
    icon: Megaphone,
    color: 'bg-green-100 text-green-700',
    paragraphs: ['Precisa avisar sobre um evento ou promoção? Escolha o público (todos, inativos, aniversariantes do mês, clube) e envie. Você acompanha quem recebeu e quem leu.'],
  },
  {
    key: 'pagamento-online',
    title: 'Pagamento on-line',
    short: 'O cliente paga o agendamento ou a comanda pelo celular, com Pix ou cartão.',
    icon: Smartphone,
    color: 'bg-emerald-100 text-emerald-700',
    paragraphs: [
      'Receba antecipadamente e reduza as faltas. Você pode exigir pagamento antecipado no agendamento on-line ou enviar o link de pagamento da comanda para o cliente.',
      'O valor cai como pagamento on-line na comanda e entra no caixa automaticamente, sem digitação.',
    ],
  },
];

export function FeatureGrid({ limit }: { limit?: number }) {
  const list = limit ? FEATURES.slice(0, limit) : FEATURES;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((f) => (
        <Link key={f.key} to={`/funcionalidades#${f.key}`} className="group">
          <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
            <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', f.color)}>
              <f.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold">{f.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{f.short}</p>
            <div className="mt-3 text-xs font-medium text-primary">Ver detalhes →</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function Personas() {
  const items = [
    { icon: Briefcase, title: 'Sou dono da barbearia', text: 'Quero cadastrar minha barbearia e gerenciar a equipe', to: '/cadastro', cta: 'Começar grátis' },
    { icon: Scissors, title: 'Trabalho em uma barbearia', text: 'Sou profissional e quero acessar minha agenda', to: '/login', cta: 'Acessar' },
    { icon: UserRound, title: 'Sou cliente', text: 'Quero agendar um horário', to: '/cliente/login', cta: 'Entrar' },
  ];
  return (
    <section className="bg-muted/50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold">Como você vai usar o Connect Barber?</h2>
        <p className="mt-2 text-center text-muted-foreground">Escolha a opção que melhor descreve você.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {items.map((p) => (
            <Link key={p.to} to={p.to} className="group">
              <Card className="flex h-full flex-col items-center p-8 text-center transition-all group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <p.icon className="h-7 w-7" />
                </div>
                <div className="mt-4 text-lg font-semibold">{p.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                <span className="mt-4 text-sm font-medium text-primary">{p.cta} →</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export const FAQ_ITEMS = [
  { q: 'Não possuo CNPJ. Posso utilizar o Connect Barber?', a: 'Sim. O Connect Barber pode ser utilizado tanto por pessoa jurídica quanto por pessoa física.' },
  { q: 'O período gratuito tem alguma limitação de funcionalidades?', a: 'Não. Durante os 30 dias de teste você usa o sistema completo, com todas as funcionalidades e sem limite de profissionais.' },
  { q: 'Meus profissionais têm acesso ao sistema?', a: 'Sim. Cada profissional pode ter o próprio login para ver a agenda e as comissões, com permissões definidas pelo gestor (dono, gestor, recepção ou profissional).' },
  { q: 'Posso alterar meu plano futuramente?', a: 'Sim. O plano depende do número de profissionais ativos. Você pode fazer upgrade ou downgrade a cada vencimento da fatura mensal.' },
  { q: 'O cliente da barbearia precisa pagar ou instalar algo?', a: 'Não. O cliente agenda pelo site da sua barbearia, pelo celular ou computador, sem instalar aplicativo e sem custo.' },
  { q: 'Consigo exportar meus dados?', a: 'Sim. Clientes, comandas e movimentações podem ser exportados em CSV pelos relatórios, e nosso suporte ajuda com exportações completas.' },
];

export function FAQ({ items = FAQ_ITEMS, title = 'Perguntas frequentes' }: { items?: { q: string; a: string }[]; title?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-8 divide-y rounded-xl border">
          {items.map((it, i) => (
            <div key={i}>
              <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium" onClick={() => setOpen(open === i ? null : i)}>
                {it.q}
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && <div className="px-5 pb-4 text-sm text-muted-foreground">{it.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="bg-gray-950 py-16 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold">Pronto para modernizar sua barbearia?</h2>
        <p className="mt-3 text-gray-300">Cadastre-se em 2 minutos e use tudo grátis por 30 dias. Sem cartão de crédito.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/cadastro" className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90">
            Teste grátis por 30 dias
          </Link>
          <Link to="/funcionalidades" className="rounded-md border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
            Ver funcionalidades
          </Link>
        </div>
      </div>
    </section>
  );
}
