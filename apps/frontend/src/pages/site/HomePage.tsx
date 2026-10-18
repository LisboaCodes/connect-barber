import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Clock, Globe, HeartHandshake, MonitorSmartphone, Rocket, Scissors, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PricingTable } from '@/components/site/PricingTable';
import { CTA, FAQ, FeatureGrid, Personas } from '@/components/site/sections';

function HeroMockup() {
  const slots = [
    { time: '09:00', name: 'João Pedro', service: 'Corte + Barba', color: 'bg-amber-500' },
    { time: '09:30', name: 'Carlos Silva', service: 'Corte degradê', color: 'bg-sky-500' },
    { time: '10:30', name: 'Rafael Lima', service: 'Barba', color: 'bg-emerald-500' },
    { time: '11:00', name: 'Horário livre', service: 'Disponível no site', color: 'bg-gray-300' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-3xl bg-primary/20 blur-2xl" />
      <Card className="relative overflow-hidden border-white/10 bg-white text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck className="h-4 w-4 text-primary" /> Agenda de hoje
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">8 agendamentos</span>
        </div>
        <div className="space-y-2 p-4">
          {slots.map((s) => (
            <div key={s.time} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="w-12 text-sm font-semibold text-gray-500">{s.time}</span>
              <span className={`h-9 w-1 rounded-full ${s.color}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="truncate text-xs text-gray-500">{s.service}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 border-t text-center text-xs">
          <div className="p-3">
            <div className="text-base font-bold">R$ 1.240</div>
            <div className="text-gray-500">Faturado hoje</div>
          </div>
          <div className="border-x p-3">
            <div className="text-base font-bold">92%</div>
            <div className="text-gray-500">Ocupação</div>
          </div>
          <div className="p-3">
            <div className="text-base font-bold">4,9 ★</div>
            <div className="text-gray-500">Satisfação</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function HomePage() {
  const goals = [
    { icon: Clock, title: 'Otimizar seu tempo', text: 'Agenda on-line 24 horas, lembretes automáticos e comandas que fecham caixa, estoque e comissão sozinhas.' },
    { icon: HeartHandshake, title: 'Fidelizar seu cliente', text: 'Programa de fidelidade, clube de clientes, mensagens de retorno e de aniversário no piloto automático.' },
    { icon: TrendingUp, title: 'Aumentar seu faturamento em até 40%', text: 'Menos faltas, agenda cheia nos horários ociosos e relatórios que mostram onde crescer.' },
  ];
  const steps = [
    { icon: UserPlus, title: 'Faça o cadastro', text: 'Em menos de 2 minutos, sem cartão de crédito e sem CNPJ obrigatório.' },
    { icon: ClipboardList, title: 'Preencha o passo a passo inicial', text: 'Horários, serviços e profissionais: o assistente guia você em cada etapa.' },
    { icon: Rocket, title: 'Teste grátis por 30 dias', text: 'Use todas as funcionalidades, sem limitação. Depois, escolha o plano ideal.' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.25),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-red-300">
              <Scissors className="h-3.5 w-3.5" /> Sistema de gestão para barbearias
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Uma nova experiência para uma <span className="text-primary">antiga tradição</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-gray-300">
              Agenda on-line, comandas, caixa, comissões, fidelidade e o site da sua barbearia em um só lugar. Seu cliente agenda sozinho, 24 horas por dia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="xl" asChild>
                <Link to="/cadastro">
                  Teste grátis por 30 dias <ArrowRight />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                <Link to="/funcionalidades">Ver funcionalidades</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-300">
              {['Sem cartão de crédito', 'Sem fidelidade', 'Suporte por WhatsApp'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* Sobre */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Sobre o Connect Barber</span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Tudo o que sua barbearia precisa, do agendamento ao caixa</h2>
            <p className="mt-4 text-muted-foreground">
              O Connect Barber é formado por duas partes que trabalham juntas: o módulo de gestão para você e sua equipe e o site da barbearia, onde seus clientes agendam e acompanham tudo.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MonitorSmartphone className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Módulo web de gestão</h3>
              <p className="mt-2 text-muted-foreground">
                Acesse pelo computador, tablet ou celular. Agenda por profissional, comandas, caixa, financeiro, estoque, comissões, relatórios e marketing, com permissões para dono, gestor, recepção e profissionais.
              </p>
            </Card>
            <Card className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Site e área do cliente</h3>
              <p className="mt-2 text-muted-foreground">
                Sua barbearia ganha um site próprio com serviços, equipe e fotos. O cliente agenda em poucos toques, recebe lembretes, acompanha seus pontos de fidelidade e o histórico de atendimentos.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Objetivo */}
      <section className="bg-muted/50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Nosso objetivo</h2>
          <p className="mt-2 text-center text-muted-foreground">Fazer sua barbearia render mais com menos esforço.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {goals.map((g) => (
              <Card key={g.title} className="p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <g.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{g.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{g.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Funcionalidades</h2>
            <p className="mt-2 text-muted-foreground">Ferramentas pensadas para a rotina da barbearia. Todas incluídas em todos os planos.</p>
          </div>
          <div className="mt-10">
            <FeatureGrid />
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" size="lg" asChild>
              <Link to="/funcionalidades">
                Conhecer todas em detalhes <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Como começar */}
      <section className="bg-gray-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Como começar</h2>
          <p className="mt-2 text-center text-gray-400">Em três passos sua barbearia está on-line.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-xl border border-white/10 bg-white/5 p-8">
                <span className="absolute right-6 top-5 text-5xl font-extrabold text-white/10">{i + 1}</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button size="xl" asChild>
              <Link to="/cadastro">Criar minha conta grátis</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="py-16 md:py-20" id="precos">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-red-800">
              <Wallet className="h-3.5 w-3.5" /> Promoção de lançamento: 30% OFF
            </span>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Planos que cabem na sua barbearia</h2>
            <p className="mt-2 text-muted-foreground">Todas as funcionalidades em todos os planos. O valor muda apenas pelo número de profissionais.</p>
          </div>
          <div className="mt-12">
            <PricingTable />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">* Valor total equivalente a 12 meses no preço promocional. Cobrança mensal, sem fidelidade.</p>
        </div>
      </section>

      <Personas />
      <FAQ />
      <CTA />
    </div>
  );
}
