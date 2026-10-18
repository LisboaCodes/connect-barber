import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarRange, Check, MousePointerClick, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { CTA, FEATURES, FeatureDef, Personas } from '@/components/site/sections';
import { cn } from '@/lib/utils/cn';

const EXTRA: FeatureDef[] = [
  {
    key: 'flexibilizacao',
    title: 'Flexibilização da agenda por dia da semana e período',
    short: 'Horários diferentes para cada dia e período, com intervalos de almoço.',
    icon: CalendarRange,
    color: 'bg-sky-100 text-sky-700',
    paragraphs: [
      'Defina o horário de funcionamento da barbearia e a jornada de cada profissional por dia da semana, com quantos períodos quiser: manhã, tarde e noite, com pausa para o almoço.',
      'Sábado com horário estendido? Segunda de folga? Tudo configurável em poucos cliques, e o site mostra apenas os horários realmente disponíveis.',
    ],
  },
  {
    key: 'controle-agenda',
    title: 'Controle automatizado da agenda',
    short: 'O sistema evita conflitos, respeita duração dos serviços e intervalos.',
    icon: ShieldCheck,
    color: 'bg-violet-100 text-violet-700',
    paragraphs: ['Nada de horário duplicado ou cliente esperando. O Connect Barber calcula a duração de cada serviço, respeita bloqueios, folgas e antecedência mínima, e confirma automaticamente quando você quiser.'],
    bullets: ['Bloqueio de horários e folgas por data', 'Confirmação automática ou manual', 'Política de cancelamento com limite de horas', 'Encaixes feitos pela recepção'],
  },
  {
    key: 'online-24-7',
    title: 'On-line 24 horas, 7 dias por semana',
    short: 'Sua agenda nunca fecha: o cliente marca de madrugada, no domingo, no feriado.',
    icon: CalendarClock,
    color: 'bg-emerald-100 text-emerald-700',
    paragraphs: ['Enquanto você dorme, a agenda continua trabalhando. Seus clientes não precisam esperar você responder mensagens para garantir um horário.'],
  },
  {
    key: 'agendar-site',
    title: 'Agendar pelo site',
    short: 'Um link para colocar no Instagram, no WhatsApp e no Google.',
    icon: MousePointerClick,
    color: 'bg-amber-100 text-amber-700',
    paragraphs: ['O cliente acessa o site da sua barbearia, escolhe o serviço, o profissional e o horário e confirma com nome e telefone. Tudo em menos de um minuto, sem instalar aplicativo.'],
  },
];

// ordem: agenda primeiro, depois o restante
const ORDER = ['flexibilizacao', 'jornada', 'controle-agenda', 'agenda-online', 'online-24-7', 'agendar-site', 'lembretes'];

function Illustration({ f }: { f: FeatureDef }) {
  const chips = (f.bullets ?? f.short.split(/[,.:]/).map((s) => s.trim()).filter((s) => s.length > 3)).slice(0, 3);
  return (
    <div className={cn('relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl', f.color)}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/40" />
      <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/30" />
      <div className="relative flex w-4/5 max-w-xs flex-col gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-lg">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', f.color)}>
            <f.icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{f.title}</div>
            <div className="mt-1 h-2 w-24 rounded-full bg-gray-200" />
          </div>
        </div>
        {chips.map((c, i) => (
          <div key={i} className={cn('flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-gray-700 shadow', i % 2 ? 'ml-6' : 'mr-6')}>
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const all = [...EXTRA, ...FEATURES];
  const list = [...ORDER.map((k) => all.find((f) => f.key === k)!).filter(Boolean), ...all.filter((f) => !ORDER.includes(f.key))];

  return (
    <div>
      <section className="bg-gray-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Funcionalidades</span>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Tudo para a gestão da sua barbearia</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">Da agenda on-line ao fechamento das comissões: conheça as ferramentas do Connect Barber. Todas incluídas em todos os planos.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {list.map((f) => (
              <a key={f.key} href={`#${f.key}`} className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
                {f.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {list.map((f, i) => (
          <section key={f.key} id={f.key} className="scroll-mt-20 border-b py-14 last:border-0 md:py-20">
            <div className={cn('grid items-center gap-10 md:grid-cols-2', i % 2 === 1 && 'md:[&>*:first-child]:order-2')}>
              <div>
                <div className={cn('mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl', f.color)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold sm:text-3xl">{f.title}</h2>
                <p className="mt-2 font-medium text-muted-foreground">{f.short}</p>
                {f.paragraphs.map((p, j) => (
                  <p key={j} className="mt-4 leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
                {f.bullets && (
                  <ul className="mt-4 space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Illustration f={f} />
            </div>
          </section>
        ))}
      </div>

      <section className="bg-primary/10 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left">
          <div>
            <h2 className="text-2xl font-bold">Experimente tudo isso grátis por 30 dias</h2>
            <p className="text-muted-foreground">Sem cartão de crédito e sem limitação de funcionalidades.</p>
          </div>
          <Button size="lg" asChild>
            <Link to="/cadastro">
              Começar agora <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <Personas />
      <CTA />
    </div>
  );
}
