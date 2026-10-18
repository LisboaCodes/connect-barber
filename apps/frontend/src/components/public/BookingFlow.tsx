import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, Check, CheckCircle2, ChevronRight, Clock, MessageCircle, Scissors, UserPlus, Users } from 'lucide-react';
import { Avatar, Button, Dialog, DialogContent, DialogFooter, EmptyState, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtDate, fmtDateLong, fmtTime, fromISODate, minutes, money, toISODate, WEEKDAYS_SHORT, whatsappLink } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { formatAddress, googleCalendarLink, publicApi, type BookedAppointment, type PublicBarbershop } from '@/lib/api/public';
import { useAuthStore } from '@/store/auth.store';
import { PoweredBy, ShopLogo, bookableProfessionals, bookableServices, groupServices, isClosedDay } from './shared';

type Step = 'services' | 'professional' | 'datetime' | 'identify' | 'confirm' | 'success';
const STEPS: { key: Step; label: string }[] = [
  { key: 'services', label: 'Serviços' },
  { key: 'professional', label: 'Profissional' },
  { key: 'datetime', label: 'Data e hora' },
  { key: 'identify', label: 'Seus dados' },
  { key: 'confirm', label: 'Confirmar' },
];

interface Draft {
  serviceIds: string[];
  /** null = qualquer profissional */
  professionalId: string | null;
  professionalChosen: boolean;
  date: string;
  time: string;
  /** profissional efetivo do horário (quando "qualquer") */
  slotProfessionalId: string;
  step: Step;
}

const draftKey = (slug: string) => `cb-booking-${slug}`;
function loadDraft(slug: string): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(draftKey(slug));
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}
function saveDraft(slug: string, d: Draft) {
  try {
    sessionStorage.setItem(draftKey(slug), JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
function clearDraft(slug: string) {
  try {
    sessionStorage.removeItem(draftKey(slug));
  } catch {
    /* ignore */
  }
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');
const maskPhone = (v: string) => {
  let d = onlyDigits(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function BookingFlow({ shop }: { shop: PublicBarbershop }) {
  const slug = shop.slug;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isLogged = useAuthStore((s) => !!s.accessToken);

  const services = useMemo(() => bookableServices(shop), [shop]);
  const groups = useMemo(() => groupServices(shop, services), [shop, services]);

  // ---------- estado inicial (rascunho salvo ou parâmetros da URL) ----------
  const initial = useRef<Draft>(
    (() => {
      const saved = loadDraft(slug);
      const qsService = params.get('servico');
      const qsProf = params.get('profissional');
      const base: Draft = { serviceIds: [], professionalId: null, professionalChosen: false, date: toISODate(), time: '', slotProfessionalId: '', step: 'services' };
      if (qsService || qsProf) {
        return {
          ...base,
          serviceIds: qsService && services.some((s) => s.id === qsService) ? [qsService] : [],
          professionalId: qsProf && shop.professionals.some((p) => p.id === qsProf) ? qsProf : null,
          professionalChosen: !!qsProf,
        };
      }
      if (saved) {
        const validIds = (saved.serviceIds ?? []).filter((id) => services.some((s) => s.id === id));
        return { ...base, ...saved, serviceIds: validIds, step: !validIds.length || saved.step === 'success' ? 'services' : saved.step === 'confirm' ? 'identify' : saved.step ?? 'services' };
      }
      return base;
    })(),
  );

  const [step, setStep] = useState<Step>(initial.current.step);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.current.serviceIds);
  const [professionalId, setProfessionalId] = useState<string | null>(initial.current.professionalId);
  const [professionalChosen, setProfessionalChosen] = useState(initial.current.professionalChosen);
  const [date, setDate] = useState(initial.current.date < toISODate() ? toISODate() : initial.current.date);
  const [time, setTime] = useState(initial.current.time);
  const [slotProfessionalId, setSlotProfessionalId] = useState(initial.current.slotProfessionalId);

  // dados do visitante
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(user?.phone ? maskPhone(user.phone) : '');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [result, setResult] = useState<{ appointment: BookedAppointment; message: string } | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    if (step !== 'success') saveDraft(slug, { serviceIds, professionalId, professionalChosen, date, time, slotProfessionalId, step });
  }, [slug, serviceIds, professionalId, professionalChosen, date, time, slotProfessionalId, step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const selected = services.filter((s) => serviceIds.includes(s.id));
  const totalPrice = selected.reduce((t, s) => t + Number(s.price), 0);
  const totalDuration = selected.reduce((t, s) => t + s.durationMinutes, 0);
  const professionals = useMemo(() => bookableProfessionals(shop, serviceIds), [shop, serviceIds]);
  const chosenProfessional = shop.professionals.find((p) => p.id === (professionalId || slotProfessionalId));

  // profissional pré-selecionado deixa de servir se mudar os serviços
  useEffect(() => {
    if (professionalId && serviceIds.length && !professionals.some((p) => p.id === professionalId)) {
      setProfessionalId(null);
      setProfessionalChosen(false);
    }
  }, [professionalId, professionals, serviceIds.length]);

  // ---------- dias ----------
  const maxDays = Math.max(1, Math.min(shop.maxAdvanceDays || 30, 90));
  const days = useMemo(() => Array.from({ length: maxDays + 1 }, (_, i) => addDays(new Date(), i)), [maxDays]);

  // ---------- disponibilidade ----------
  const availability = useQuery({
    queryKey: ['public-availability', slug, date, professionalId ?? 'any', serviceIds.join(',')],
    queryFn: () => publicApi.availability(slug, { date, professionalId: professionalId ?? undefined, serviceIds }),
    enabled: step === 'datetime' && serviceIds.length > 0,
    staleTime: 15_000,
  });

  /** horários -> profissionais disponíveis (ordem de exibição) */
  const slots = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of availability.data ?? []) {
      if (a.off) continue;
      for (const t of a.slots) {
        const list = map.get(t) ?? [];
        list.push(a.professionalId);
        map.set(t, list);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, profs]) => ({ time: t, professionals: profs }));
  }, [availability.data]);

  const periods = useMemo(() => {
    const p = [
      { label: 'Manhã', items: [] as typeof slots },
      { label: 'Tarde', items: [] as typeof slots },
      { label: 'Noite', items: [] as typeof slots },
    ];
    for (const s of slots) {
      const h = Number(s.time.slice(0, 2));
      p[h < 12 ? 0 : h < 18 ? 1 : 2].items.push(s);
    }
    return p.filter((x) => x.items.length);
  }, [slots]);

  const pickSlot = (s: { time: string; professionals: string[] }) => {
    setTime(s.time);
    setSlotProfessionalId(professionalId ?? s.professionals[0]);
  };

  // horário salvo que não existe mais
  useEffect(() => {
    if (availability.data && time && !slots.some((s) => s.time === time)) {
      setTime('');
      setSlotProfessionalId('');
    }
  }, [availability.data, slots, time]);

  // ---------- agendamento ----------
  const book = useMutation({
    mutationFn: () =>
      publicApi.book(slug, {
        professionalId: professionalId ?? slotProfessionalId,
        serviceIds,
        date,
        time,
        ...(isLogged
          ? { phone: onlyDigits(phone) || undefined }
          : { name: name.trim(), phone: onlyDigits(phone), email: email.trim() || undefined }),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (r) => {
      setResult(r);
      clearDraft(slug);
      setStep('success');
      toast.success(r.message || 'Agendamento realizado!');
    },
    onError: (e) => {
      toast.error(errorMessage(e, 'Não foi possível agendar'));
      const status = (e as any)?.response?.status;
      if (status === 400 || status === 409) {
        qc.invalidateQueries({ queryKey: ['public-availability', slug] });
        setTime('');
        setStep('datetime');
      }
    },
  });

  const validateIdentify = () => {
    const e: Record<string, string> = {};
    if (!isLogged) {
      if (name.trim().length < 2) e.name = 'Informe seu nome';
      if (onlyDigits(phone).length < 10) e.phone = 'Informe um telefone válido com DDD';
      if (email.trim() && !validEmail(email.trim())) e.email = 'E-mail inválido';
    } else if (phone && onlyDigits(phone).length < 10) e.phone = 'Telefone inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const goBack = () => {
    if (step === 'services' || step === 'success') navigate(`/b/${slug}`);
    else setStep(STEPS[stepIndex - 1].key);
  };

  const canNext =
    (step === 'services' && serviceIds.length > 0) ||
    (step === 'professional' && professionalChosen) ||
    (step === 'datetime' && !!time && !!(professionalId || slotProfessionalId)) ||
    step === 'identify';

  const next = () => {
    if (step === 'identify' && !validateIdentify()) return;
    if (step === 'services' && professionalChosen && professionalId && !professionals.some((p) => p.id === professionalId)) {
      setProfessionalId(null);
      setProfessionalChosen(false);
    }
    setStep(STEPS[stepIndex + 1].key);
  };

  const loginRedirect = `/cliente/login?redirect=${encodeURIComponent(`/b/${slug}/agendar`)}`;
  const wa = shop.whatsapp || shop.phone;

  // ====================== RENDER ======================
  if (!services.length) {
    return (
      <Shell shop={shop} onBack={() => navigate(`/b/${slug}`)} title="Agendar">
        <EmptyState icon={Scissors} title="Nenhum serviço disponível online" description="Entre em contato com a barbearia para agendar." action={wa ? <WhatsButton phone={wa} text="Olá! Gostaria de agendar um horário." /> : undefined} />
      </Shell>
    );
  }

  if (step === 'success' && result) {
    const a = result.appointment;
    const profName = a.professional?.name ?? chosenProfessional?.name;
    const svcNames = (a.services?.length ? a.services.map((s) => s.name) : selected.map((s) => s.name)).join(', ');
    const when = `${fmtDateLong(a.startAt)} às ${fmtTime(a.startAt)}`;
    const calendar = googleCalendarLink({
      title: `${svcNames} - ${shop.name}`,
      start: a.startAt,
      end: a.endAt,
      details: `Profissional: ${profName ?? '-'}\nAgendado pelo site da ${shop.name}.`,
      location: formatAddress(shop.address),
    });
    return (
      <Shell shop={shop} onBack={() => navigate(`/b/${slug}`)} title="Agendamento">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold">{a.status === 'CONFIRMED' ? 'Agendamento confirmado!' : 'Agendamento recebido!'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
          <div className="mt-6 space-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
            <Row label="Quando" value={<span className="capitalize">{when}</span>} />
            {profName && <Row label="Profissional" value={profName} />}
            <Row label="Serviços" value={svcNames} />
            <Row label="Total" value={<span className="font-semibold">{money(a.totalPrice ?? totalPrice)}</span>} />
            {formatAddress(shop.address) && <Row label="Local" value={formatAddress(shop.address)} />}
          </div>
          {shop.cancelLimitHours > 0 && <p className="mt-3 text-xs text-muted-foreground">Cancelamentos online até {shop.cancelLimitHours}h antes do horário.</p>}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" size="lg">
              <a href={calendar} target="_blank" rel="noreferrer">
                <CalendarPlus /> Adicionar ao calendário
              </a>
            </Button>
            {wa && (
              <Button asChild variant="success" size="lg">
                <a href={whatsappLink(wa, `Olá! Acabei de agendar pelo site: ${svcNames}, ${when}${profName ? ` com ${profName}` : ''}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle /> Falar no WhatsApp
                </a>
              </Button>
            )}
          </div>
          {isLogged ? (
            <Button asChild className="mt-2 w-full" size="lg">
              <Link to="/cliente">Ver meus agendamentos</Link>
            </Button>
          ) : (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
              <div className="flex items-start gap-3">
                <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900">Crie sua conta para acompanhar</div>
                  <p className="text-sm text-red-900/80">Veja seus agendamentos, cancele quando precisar e acompanhe seus pontos de fidelidade.</p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/cliente/cadastro">Criar conta grátis</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
          <Button variant="link" className="mt-3" onClick={() => navigate(`/b/${slug}`)}>
            Voltar ao site da barbearia
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell shop={shop} onBack={goBack} title="Agendar horário">
      {/* Indicador de etapas */}
      <ol className="mb-5 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 flex-col gap-1">
            <div className={cn('h-1.5 rounded-full', i <= stepIndex ? 'bg-red-500' : 'bg-gray-200')} />
            <span className={cn('hidden text-[11px] sm:block', i === stepIndex ? 'font-semibold text-gray-900' : 'text-muted-foreground')}>{s.label}</span>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 text-lg font-bold sm:hidden">
        {stepIndex + 1}. {STEPS[stepIndex]?.label}
      </h2>

      {/* 1) Serviços */}
      {step === 'services' && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Selecione um ou mais serviços.</p>
          {groups.map((g) => (
            <div key={g.id}>
              {groups.length > 1 && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</h3>}
              <div className="space-y-2">
                {g.services.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                      className={cn('flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition-colors', on ? 'border-red-500 ring-2 ring-red-500/30' : 'hover:border-gray-300')}
                    >
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.name}</span>
                        {s.description && <span className="block truncate text-xs text-muted-foreground">{s.description}</span>}
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {minutes(s.durationMinutes)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-semibold">{money(s.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2) Profissional */}
      {step === 'professional' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ProfCard
            active={professionalChosen && professionalId === null}
            onClick={() => {
              setProfessionalId(null);
              setProfessionalChosen(true);
              setTime('');
            }}
            avatar={
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                <Users className="h-6 w-6" />
              </div>
            }
            name="Qualquer profissional"
            subtitle="Mostra todos os horários livres"
          />
          {professionals.map((p) => (
            <ProfCard
              key={p.id}
              active={professionalChosen && professionalId === p.id}
              onClick={() => {
                setProfessionalId(p.id);
                setProfessionalChosen(true);
                setTime('');
              }}
              avatar={<Avatar src={p.avatarUrl} name={p.name} color={p.color ?? '#d97706'} size="lg" />}
              name={p.name}
              subtitle={p.bio ?? undefined}
            />
          ))}
          {professionals.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nenhum profissional realiza todos os serviços selecionados online. Tente outra combinação ou escolha "Qualquer profissional".</p>}
        </div>
      )}

      {/* 3) Data e horário */}
      {step === 'datetime' && (
        <div className="space-y-5">
          <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-thin">
            <div className="flex gap-2">
              {days.map((d) => {
                const iso = toISODate(d);
                const closed = isClosedDay(shop.openingHours, d.getDay());
                const active = iso === date;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={closed}
                    onClick={() => {
                      setDate(iso);
                      setTime('');
                      setSlotProfessionalId('');
                    }}
                    className={cn(
                      'flex w-14 shrink-0 flex-col items-center rounded-xl border bg-white py-2 transition-colors',
                      active ? 'border-red-500 bg-red-500 text-white' : 'hover:border-gray-300',
                      closed && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className={cn('text-[11px] uppercase', active ? 'text-white/90' : 'text-muted-foreground')}>{WEEKDAYS_SHORT[d.getDay()]}</span>
                    <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                    <span className={cn('text-[10px]', active ? 'text-white/90' : 'text-muted-foreground')}>{fmtDate(d, 'MMM')}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-sm font-medium capitalize">{fmtDateLong(fromISODate(date))}</div>

          {availability.isLoading ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : availability.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorMessage(availability.error, 'Não foi possível carregar os horários.')}
              <Button size="sm" variant="outline" className="ml-2" onClick={() => availability.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-6 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-2 font-semibold">Sem horários disponíveis neste dia</div>
              <p className="mt-1 text-sm text-muted-foreground">Escolha outra data ou entre na lista de espera — avisamos se surgir uma vaga.</p>
              <Button className="mt-4" variant="outline" onClick={() => setWaitlistOpen(true)}>
                Entrar na lista de espera
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {periods.map((p) => (
                <div key={p.label}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {p.items.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => pickSlot(s)}
                        className={cn('h-10 rounded-lg border bg-white text-sm font-medium transition-colors', time === s.time ? 'border-red-500 bg-red-500 text-white' : 'hover:border-red-400')}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!professionalId && time && chosenProfessional && (
                <p className="text-sm text-muted-foreground">
                  Profissional: <span className="font-medium text-gray-900">{chosenProfessional.name}</span>
                </p>
              )}
              <button type="button" className="text-sm font-medium text-red-700 hover:underline" onClick={() => setWaitlistOpen(true)}>
                Não encontrou um bom horário? Entre na lista de espera
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4) Identificação */}
      {step === 'identify' && (
        <div className="space-y-4">
          {isLogged && user ? (
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-3">
                <Avatar src={user.avatarUrl} name={user.name} size="lg" color="#d97706" />
                <div>
                  <div className="text-sm text-muted-foreground">Agendando como</div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <Field label="Telefone (WhatsApp)" className="mt-4" error={errors.phone} hint={!user.phone ? 'Informe para receber lembretes do horário.' : undefined}>
                <Input inputMode="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
              </Field>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border bg-white p-4">
              <Field label="Nome" required error={errors.name}>
                <Input autoComplete="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Telefone (WhatsApp)" required error={errors.phone}>
                <Input inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
              </Field>
              <Field label="E-mail" error={errors.email} hint="Opcional">
                <Input type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <p className="text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link to={loginRedirect} className="font-medium text-red-700 hover:underline">
                  Entrar
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 5) Confirmação */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border bg-white p-4 text-sm">
            <Row label="Data" value={<span className="capitalize">{fmtDateLong(fromISODate(date))}</span>} />
            <Row label="Horário" value={`${time} (${minutes(totalDuration)})`} />
            <Row label="Profissional" value={chosenProfessional?.name ?? '-'} />
            <Row label="Cliente" value={isLogged ? user?.name : name} />
            <div className="border-t pt-2">
              {selected.map((s) => (
                <div key={s.id} className="flex justify-between py-0.5">
                  <span>{s.name}</span>
                  <span>{money(s.price)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{money(totalPrice)}</span>
              </div>
            </div>
          </div>
          <Field label="Observações" hint="Opcional">
            <Textarea maxLength={500} rows={3} placeholder="Algo que a barbearia precise saber?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {shop.cancelLimitHours > 0 && <p className="text-xs text-muted-foreground">Você poderá cancelar online até {shop.cancelLimitHours}h antes do horário.</p>}
          {shop.paymentInfo && <p className="text-xs text-muted-foreground">Pagamento na barbearia. {shop.paymentInfo}</p>}
          <Button size="xl" className="w-full" loading={book.isPending} onClick={() => book.mutate()}>
            Confirmar agendamento
          </Button>
        </div>
      )}

      {/* Barra inferior com resumo */}
      {step !== 'confirm' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {serviceIds.length ? (
                <>
                  <div className="font-semibold">{money(totalPrice)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {serviceIds.length} serviço(s) · {minutes(totalDuration)}
                    {step === 'datetime' && time ? ` · ${fmtDate(fromISODate(date), 'dd/MM')} ${time}` : ''}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Nenhum serviço selecionado</span>
              )}
            </div>
            <Button size="lg" disabled={!canNext} onClick={next}>
              Continuar <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        shop={shop}
        date={date}
        professionalId={professionalId ?? undefined}
        serviceId={serviceIds[0]}
        isLogged={isLogged}
        defaultName={name}
        defaultPhone={phone}
      />
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function Shell({ shop, onBack, title, children }: { shop: PublicBarbershop; onBack: () => void; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ShopLogo name={shop.name} logoUrl={shop.logoUrl} className="h-9 w-9 rounded-lg text-xs" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{shop.name}</div>
            <div className="text-xs text-muted-foreground">{title}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
      <PoweredBy className="pb-4" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ProfCard({ active, onClick, avatar, name, subtitle }: { active: boolean; onClick: () => void; avatar: ReactNode; name: string; subtitle?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-colors', active ? 'border-red-500 ring-2 ring-red-500/30' : 'hover:border-gray-300')}>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{name}</span>
        {subtitle && <span className="line-clamp-2 block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-red-500" />}
    </button>
  );
}

function WhatsButton({ phone, text }: { phone: string; text: string }) {
  return (
    <Button asChild variant="success">
      <a href={whatsappLink(phone, text)} target="_blank" rel="noreferrer">
        <MessageCircle /> Chamar no WhatsApp
      </a>
    </Button>
  );
}

function WaitlistDialog({
  open,
  onOpenChange,
  shop,
  date,
  professionalId,
  serviceId,
  isLogged,
  defaultName,
  defaultPhone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shop: PublicBarbershop;
  date: string;
  professionalId?: string;
  serviceId?: string;
  isLogged: boolean;
  defaultName: string;
  defaultPhone: string;
}) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [period, setPeriod] = useState<'any' | 'morning' | 'afternoon' | 'night'>('any');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setPhone(defaultPhone);
      setDone(false);
    }
  }, [open, defaultName, defaultPhone]);

  const PERIODS = { any: null, morning: ['08:00', '12:00'], afternoon: ['12:00', '18:00'], night: ['18:00', '23:00'] } as const;
  const join = useMutation({
    mutationFn: () => {
      const p = PERIODS[period];
      return publicApi.waitlist(shop.slug, {
        date,
        professionalId,
        serviceId,
        ...(p ? { periodStart: p[0], periodEnd: p[1] } : {}),
        ...(isLogged ? (onlyDigits(phone) ? { phone: onlyDigits(phone) } : {}) : { name: name.trim(), phone: onlyDigits(phone) }),
      });
    },
    onSuccess: () => {
      setDone(true);
      toast.success('Você entrou na lista de espera!');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const invalid = !isLogged && (name.trim().length < 2 || onlyDigits(phone).length < 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Lista de espera" description={`Avisaremos se abrir uma vaga em ${fmtDate(fromISODate(date), "dd/MM (EEEE)")}.`}>
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-2 font-semibold">Pronto! Você está na lista.</p>
            <p className="text-sm text-muted-foreground">A barbearia entrará em contato se surgir um horário.</p>
            <Button className="mt-4 w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {!isLogged && (
                <>
                  <Field label="Nome" required>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                  </Field>
                  <Field label="Telefone (WhatsApp)" required>
                    <Input inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
                  </Field>
                </>
              )}
              <Field label="Período preferido">
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      ['any', 'Qualquer'],
                      ['morning', 'Manhã'],
                      ['afternoon', 'Tarde'],
                      ['night', 'Noite'],
                    ] as const
                  ).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setPeriod(k)} className={cn('rounded-md border py-1.5 text-xs font-medium', period === k ? 'border-red-500 bg-red-50 text-red-800' : 'hover:bg-gray-50')}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button loading={join.isPending} disabled={invalid} onClick={() => join.mutate()}>
                Entrar na lista
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
