import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Check, CreditCard, Delete, Hand, QrCode, Scissors, Store, UserPlus, Wallet } from 'lucide-react';
import { errorMessage } from '@/lib/api/client';
import { kioskClient, type KioskAppointment, type KioskClient, type KioskConfig, type KioskIdentify, type KioskOrder, type KioskPayResult } from '@/lib/api/kiosk';
import { cn } from '@/lib/utils/cn';
import { fmtPhone, minutes, money } from '@/lib/utils/format';
import { Spinner } from '@/components/ui';

/* Totem de autoatendimento: tela cheia, botões grandes, volta à tela inicial após inatividade. */

type Screen = 'idle' | 'phone' | 'register' | 'home' | 'walkin' | 'pay' | 'paying' | 'done';
const IDLE_MS = 90_000;
const DONE_MS = 8_000;

const fmtPhoneInput = (d: string) => {
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};

export default function KioskPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('k') ?? '';
  const api = useMemo(() => kioskClient(slug, token), [slug, token]);
  const cfg = useQuery({ queryKey: ['kiosk-config', slug, token], queryFn: api.config, retry: 1, enabled: !!slug && !!token });

  const [screen, setScreen] = useState<Screen>('idle');
  const [phone, setPhone] = useState('');
  const [data, setData] = useState<KioskIdentify | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payOrder, setPayOrder] = useState<KioskOrder | null>(null);
  const [payResult, setPayResult] = useState<KioskPayResult | null>(null);
  const [doneMsg, setDoneMsg] = useState<{ title: string; text?: string } | null>(null);
  const timer = useRef<number | null>(null);

  const reset = useCallback(() => {
    setScreen('idle');
    setPhone('');
    setData(null);
    setError(null);
    setPayOrder(null);
    setPayResult(null);
    setDoneMsg(null);
  }, []);

  // inatividade → volta ao início
  useEffect(() => {
    const bump = () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (screen !== 'idle' && screen !== 'paying') timer.current = window.setTimeout(reset, IDLE_MS);
    };
    bump();
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [screen, reset]);

  // Mostra o agradecimento por alguns segundos e libera o totem para o próximo cliente.
  useEffect(() => {
    if (screen !== 'done') return;
    const timeout = window.setTimeout(reset, DONE_MS);
    return () => window.clearTimeout(timeout);
  }, [screen, reset]);

  useEffect(() => {
    document.title = cfg.data ? `Totem · ${cfg.data.name}` : 'Totem';
  }, [cfg.data]);

  const identify = useMutation({
    mutationFn: () => api.identify(phone),
    onSuccess: (r) => {
      setError(null);
      setData(r);
      setScreen(r.found ? 'home' : 'register');
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const refresh = useCallback(async () => {
    if (!data?.client?.phone) return;
    const r = await api.identify(data.client.phone);
    setData(r);
  }, [api, data?.client?.phone]);

  if (!slug || !token) return <Center><Msg title="Totem não configurado" text="Abra o link gerado em Configurações › Pagamento online e totem." /></Center>;
  if (cfg.isLoading) return <Center><Spinner className="h-10 w-10 text-white" /></Center>;
  if (cfg.error || !cfg.data) return <Center><Msg title="Totem indisponível" text={errorMessage(cfg.error, 'Verifique o link do totem.')} /></Center>;
  const c = cfg.data;

  return (
    <div className="flex min-h-screen select-none flex-col bg-moss-950 text-white">
      {/* topo */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500 text-xl font-bold text-moss-950">{c.name[0]}</div>}
          <div>
            <div className="text-lg font-bold leading-tight">{c.name}</div>
            <div className="text-xs text-white/60">Autoatendimento</div>
          </div>
        </div>
        {screen !== 'idle' && (
          <button onClick={reset} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10">
            Sair
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-10">
        {screen === 'idle' && (
          <button onClick={() => setScreen('phone')} className="group flex flex-1 flex-col items-center justify-center gap-8 text-center">
            {c.coverUrl && <img src={c.coverUrl} alt="" className="h-48 w-full rounded-3xl object-cover opacity-80" />}
            <div>
              <div className="text-5xl font-black tracking-tight">Bem-vindo!</div>
              <p className="mt-3 text-xl text-white/70">Faça seu check-in, pague sua comanda ou agende sua próxima visita.</p>
            </div>
            <div className="rounded-full bg-gold-500 px-12 py-6 text-2xl font-bold text-moss-950 shadow-[0_15px_40px_-10px_rgba(165,140,100,0.7)] transition-transform group-active:scale-95">
              Toque para começar
            </div>
          </button>
        )}

        {screen === 'phone' && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-3xl font-bold">Digite seu celular</div>
            <p className="mt-1 text-white/60">Com DDD. Usamos para encontrar seu cadastro.</p>
            <div className="mt-6 flex h-16 w-full max-w-sm items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-3xl font-semibold tracking-wider">{fmtPhoneInput(phone) || <span className="text-white/30">(00) 00000-0000</span>}</div>
            {error && <div className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{error}</div>}
            <Keypad value={phone} onChange={(v) => setPhone(v.slice(0, 11))} />
            <BigButton className="mt-6 w-full max-w-sm" disabled={phone.length < 10 || identify.isPending} onClick={() => identify.mutate()}>
              {identify.isPending ? <Spinner className="h-6 w-6 text-moss-950" /> : 'Continuar'}
            </BigButton>
          </div>
        )}

        {screen === 'register' && data && <RegisterScreen api={api} phone={data.phone ?? phone} onDone={(r) => { setData(r); setScreen('home'); }} onBack={() => setScreen('phone')} />}

        {screen === 'home' && data?.client && (
          <HomeScreen
            data={data}
            cfg={c}
            api={api}
            onRefresh={refresh}
            onWalkIn={() => setScreen('walkin')}
            onPay={(o) => { setPayOrder(o); setScreen('pay'); }}
            onBook={() => window.open(`/b/${slug}/agendar`, '_self')}
            onDone={(m) => { setDoneMsg(m); setScreen('done'); }}
          />
        )}

        {screen === 'walkin' && data?.client && (
          <WalkInScreen cfg={c} api={api} client={data.client} onBack={() => setScreen('home')} onDone={(m) => { setDoneMsg(m); setScreen('done'); }} />
        )}

        {screen === 'pay' && payOrder && (
          <PayScreen
            cfg={c}
            order={payOrder}
            api={api}
            onBack={() => setScreen('home')}
            onStarted={(r) => {
              setPayResult(r);
              if (r.counter) { setDoneMsg({ title: 'Combinado!', text: 'Pague no balcão com nossa equipe. Obrigado!' }); setScreen('done'); }
              else if (r.paid) { setDoneMsg({ title: 'Comanda já paga', text: 'Não há valor pendente.' }); setScreen('done'); }
              else setScreen('paying');
            }}
          />
        )}

        {screen === 'paying' && payResult?.intent && (
          <PayingScreen api={api} intent={payResult.intent} amount={payResult.remaining} onCancel={() => setScreen('pay')} onPaid={() => { setDoneMsg({ title: 'Pagamento confirmado!', text: 'Obrigado pela preferência. Até a próxima!' }); setScreen('done'); }} />
        )}

        {screen === 'done' && doneMsg && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><Check className="h-12 w-12" /></div>
            <div className="mt-6 text-4xl font-black">{doneMsg.title}</div>
            {doneMsg.text && <p className="mt-2 max-w-md text-lg text-white/70">{doneMsg.text}</p>}
            <p className="mt-6 text-sm text-white/50">Voltando ao início em alguns segundos…</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {data?.client && (
                <button onClick={async () => { await refresh(); setScreen('home'); }} className="rounded-2xl border border-white/15 px-8 py-4 text-lg font-semibold hover:bg-white/10">Voltar ao meu painel</button>
              )}
              <BigButton onClick={reset}>Concluir</BigButton>
            </div>
          </div>
        )}
      </main>
      <footer className="pb-4 text-center text-xs text-white/40">Totem Connect Barber</footer>
    </div>
  );
}

// ---------------------------------------------------------------- telas

function HomeScreen({ data, cfg, api, onRefresh, onWalkIn, onPay, onBook, onDone }: { data: KioskIdentify; cfg: KioskConfig; api: ReturnType<typeof kioskClient>; onRefresh: () => Promise<void>; onWalkIn: () => void; onPay: (o: KioskOrder) => void; onBook: () => void; onDone: (m: { title: string; text?: string }) => void }) {
  const client = data.client as KioskClient;
  const appts = data.appointments ?? [];
  const orders = data.openOrders ?? [];
  const checkin = useMutation({
    mutationFn: (id: string) => api.checkin(id),
    onSuccess: async (r, id) => {
      await onRefresh();
      const a = appts.find((x) => x.id === id);
      onDone({ title: r.already ? 'Check-in já feito' : `Check-in feito, ${client.firstName}!`, text: a ? `${a.professional.name} já foi avisado. Seu horário é às ${a.time}. Fique à vontade!` : undefined });
    },
  });
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <div className="text-3xl font-bold">Olá, {client.firstName}! 👋</div>
        <div className="mt-1 text-white/60">{fmtPhone(client.phone)} · {client.visitsCount} visita(s) · {client.loyaltyPoints} pontos</div>
      </div>

      {appts.length > 0 && (
        <section>
          <SectionLabel>Seus horários de hoje</SectionLabel>
          <div className="space-y-3">
            {appts.map((a: KioskAppointment) => (
              <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gold-500 text-moss-950"><span className="text-xl font-black leading-none">{a.time}</span></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.services.join(', ')}</div>
                  <div className="text-sm text-white/60">com {a.professional.name} · {money(a.totalPrice)}{a.prepaidAmount > 0 ? ` · sinal ${money(a.prepaidAmount)}` : ''}</div>
                </div>
                {a.checkedInAt ? (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-300">Check-in feito</span>
                ) : (
                  <BigButton small onClick={() => checkin.mutate(a.id)} disabled={checkin.isPending}><Hand className="h-5 w-5" /> Cheguei</BigButton>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section>
          <SectionLabel>Comanda em aberto</SectionLabel>
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Comanda #{o.number}</div>
                  <div className="text-xl font-black text-gold-400">{money(o.remaining)}</div>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between"><span>{i.quantity > 1 ? `${i.quantity}× ` : ''}{i.description}</span><span>{money(i.total)}</span></li>
                  ))}
                  {o.paidTotal > 0 && <li className="flex justify-between text-emerald-300"><span>Já pago</span><span>- {money(o.paidTotal)}</span></li>}
                </ul>
                {o.remaining > 0 && <BigButton className="mt-4 w-full" onClick={() => onPay(o)}><Wallet className="h-5 w-5" /> Pagar {money(o.remaining)}</BigButton>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>O que você quer fazer?</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {appts.length === 0 && (
            <Tile icon={Scissors} title="Quero ser atendido agora" text="Encaixe no próximo horário livre de hoje" onClick={onWalkIn} />
          )}
          <Tile icon={CalendarPlus} title="Agendar próxima visita" text={data.nextAppointment ? 'Você já tem um horário marcado' : 'Escolha serviço, profissional e horário'} onClick={onBook} />
          {!cfg.payments.pix && !cfg.payments.pos && orders.length > 0 && <Tile icon={Store} title="Pagar no balcão" text="Nossa equipe recebe seu pagamento" onClick={() => onPay(orders[0])} />}
        </div>
      </section>
    </div>
  );
}

function RegisterScreen({ api, phone, onDone, onBack }: { api: ReturnType<typeof kioskClient>; phone: string; onDone: (r: KioskIdentify) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const reg = useMutation({ mutationFn: () => api.register({ name, phone, email: email || undefined }), onSuccess: (r) => onDone({ ...r, found: true }) });
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/20 text-gold-300"><UserPlus className="h-8 w-8" /></div>
      <div className="mt-4 text-3xl font-bold">Primeira vez aqui?</div>
      <p className="mt-1 text-white/60">Vamos fazer seu cadastro rapidinho. Telefone: {fmtPhone(phone)}</p>
      <div className="mt-6 w-full max-w-md space-y-3">
        <input autoFocus className="h-14 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-lg outline-none focus:border-gold-400" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="h-14 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-lg outline-none focus:border-gold-400" placeholder="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {reg.error && <div className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{errorMessage(reg.error)}</div>}
        <div className="flex gap-3">
          <button onClick={onBack} className="rounded-2xl border border-white/15 px-6 text-lg font-semibold hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
          <BigButton className="flex-1" disabled={name.trim().length < 2 || reg.isPending} onClick={() => reg.mutate()}>Cadastrar e continuar</BigButton>
        </div>
      </div>
    </div>
  );
}

function WalkInScreen({ cfg, api, client, onBack, onDone }: { cfg: KioskConfig; api: ReturnType<typeof kioskClient>; client: KioskClient; onBack: () => void; onDone: (m: { title: string; text?: string }) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [pro, setPro] = useState<string | undefined>(undefined);
  const total = cfg.services.filter((s) => sel.includes(s.id)).reduce((a, s) => a + Number(s.price), 0);
  const dur = cfg.services.filter((s) => sel.includes(s.id)).reduce((a, s) => a + s.durationMinutes, 0);
  const walk = useMutation({
    mutationFn: () => api.walkIn({ clientId: client.id, serviceIds: sel, professionalId: pro }),
    onSuccess: (r) => onDone({ title: `Você está na fila, ${client.firstName}!`, text: `${r.appointment.professional?.name ?? 'Um profissional'} atende você às ${r.appointment.time}${r.appointment.waitMinutes > 0 ? ` (cerca de ${r.appointment.waitMinutes} min)` : ''}. Já avisamos a equipe.` }),
  });
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-full border border-white/15 p-3 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
        <div><div className="text-2xl font-bold">Atendimento agora</div><div className="text-sm text-white/60">Escolha o que você quer fazer hoje</div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cfg.services.map((s) => {
          const on = sel.includes(s.id);
          return (
            <button key={s.id} onClick={() => setSel((x) => (on ? x.filter((i) => i !== s.id) : [...x, s.id]))} className={cn('flex items-center justify-between rounded-2xl border p-4 text-left transition-colors', on ? 'border-gold-400 bg-gold-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
              <div><div className="font-semibold">{s.name}</div><div className="text-xs text-white/60">{minutes(s.durationMinutes)}</div></div>
              <div className="font-bold">{money(s.price)}</div>
            </button>
          );
        })}
      </div>
      <div>
        <SectionLabel>Profissional</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <Chip on={!pro} onClick={() => setPro(undefined)}>Qualquer (mais rápido)</Chip>
          {cfg.professionals.map((p) => <Chip key={p.id} on={pro === p.id} onClick={() => setPro(p.id)}>{p.name}</Chip>)}
        </div>
      </div>
      {walk.error && <div className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{errorMessage(walk.error)}</div>}
      <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div><div className="text-sm text-white/60">{sel.length} serviço(s) · {minutes(dur)}</div><div className="text-2xl font-black">{money(total)}</div></div>
        <BigButton disabled={!sel.length || walk.isPending} onClick={() => walk.mutate()}>{walk.isPending ? <Spinner className="h-6 w-6 text-moss-950" /> : 'Entrar na fila'}</BigButton>
      </div>
    </div>
  );
}

function PayScreen({ cfg, order, api, onBack, onStarted }: { cfg: KioskConfig; order: KioskOrder; api: ReturnType<typeof kioskClient>; onBack: () => void; onStarted: (r: KioskPayResult) => void }) {
  const pay = useMutation({ mutationFn: (m: 'PIX' | 'POS' | 'COUNTER') => api.pay(order.id, m), onSuccess: onStarted });
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-full border border-white/15 p-3 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
        <div><div className="text-2xl font-bold">Como você quer pagar?</div><div className="text-sm text-white/60">Comanda #{order.number} · {money(order.remaining)}</div></div>
      </div>
      {pay.error && <div className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">{errorMessage(pay.error)}</div>}
      <div className="grid gap-3">
        {cfg.payments.pix && <Tile icon={QrCode} title="Pix" text="Escaneie o QR code no app do seu banco" onClick={() => pay.mutate('PIX')} disabled={pay.isPending} big />}
        {cfg.payments.pos && <Tile icon={CreditCard} title="Cartão na maquininha" text="Débito ou crédito. A cobrança vai para a maquininha ao lado" onClick={() => pay.mutate('POS')} disabled={pay.isPending} big />}
        <Tile icon={Store} title="Pagar no balcão" text="Dinheiro, Pix ou cartão com nossa equipe" onClick={() => pay.mutate('COUNTER')} disabled={pay.isPending} big />
      </div>
    </div>
  );
}

function PayingScreen({ api, intent, amount, onCancel, onPaid }: { api: ReturnType<typeof kioskClient>; intent: NonNullable<KioskPayResult['intent']>; amount: number; onCancel: () => void; onPaid: () => void }) {
  const [status, setStatus] = useState(intent.status);
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const r = await api.paymentStatus(intent.id);
        setStatus(r.status);
        if (r.status === 'PAID') { window.clearInterval(id); onPaid(); }
        if (r.status === 'EXPIRED' || r.status === 'FAILED') window.clearInterval(id);
      } catch { /* tenta de novo */ }
    }, 3000);
    return () => window.clearInterval(id);
  }, [api, intent.id, onPaid]);
  const src = intent.qrCode ? (intent.qrCode.startsWith('data:') || intent.qrCode.startsWith('http') ? intent.qrCode : `data:image/png;base64,${intent.qrCode}`) : null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="text-3xl font-bold">{intent.kind === 'POS' ? 'Passe o cartão na maquininha' : 'Escaneie para pagar'}</div>
      <div className="mt-1 text-xl text-gold-400">{money(amount)}</div>
      <div className="mt-6">
        {status !== 'PENDING' ? (
          <div className="rounded-2xl bg-red-500/20 px-6 py-4 text-red-200">A cobrança expirou ou falhou. Tente novamente.</div>
        ) : intent.kind === 'POS' ? (
          <div className="flex flex-col items-center gap-4"><CreditCard className="h-20 w-20 text-gold-400" /><Spinner className="h-8 w-8 text-white" /><p className="text-white/70">Siga as instruções na maquininha…</p></div>
        ) : src ? (
          <div className="flex flex-col items-center gap-4"><img src={src} alt="QR code Pix" className="h-72 w-72 rounded-2xl bg-white p-3" /><div className="flex items-center gap-2 text-white/70"><Spinner className="h-4 w-4 text-white" /> Aguardando confirmação do banco…</div></div>
        ) : <Spinner className="h-10 w-10 text-white" />}
      </div>
      <button onClick={onCancel} className="mt-8 rounded-2xl border border-white/15 px-8 py-4 text-lg font-semibold hover:bg-white/10">{status === 'PENDING' ? 'Escolher outra forma' : 'Voltar'}</button>
    </div>
  );
}

// ---------------------------------------------------------------- peças

function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === '' ? <div key={i} /> : (
          <button key={i} onClick={() => onChange(k === 'del' ? value.slice(0, -1) : value + k)} className="flex h-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl font-semibold active:bg-gold-500 active:text-moss-950">
            {k === 'del' ? <Delete className="h-6 w-6" /> : k}
          </button>
        ),
      )}
    </div>
  );
}

function BigButton({ children, className, small, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) {
  return (
    <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-2xl bg-gold-500 font-bold text-moss-950 shadow-lg transition-transform active:scale-95 disabled:opacity-40', small ? 'px-5 py-3 text-base' : 'px-8 py-4 text-lg', className)}>
      {children}
    </button>
  );
}

function Tile({ icon: Icon, title, text, onClick, disabled, big }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; onClick: () => void; disabled?: boolean; big?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn('flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 text-left transition-colors hover:border-gold-400/60 hover:bg-white/10 disabled:opacity-50', big ? 'p-6' : 'p-4')}>
      <div className={cn('flex shrink-0 items-center justify-center rounded-xl bg-gold-500/20 text-gold-300', big ? 'h-16 w-16' : 'h-12 w-12')}><Icon className={big ? 'h-8 w-8' : 'h-6 w-6'} /></div>
      <div><div className={cn('font-bold', big && 'text-xl')}>{title}</div><div className="text-sm text-white/60">{text}</div></div>
    </button>
  );
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={cn('rounded-full border px-4 py-2 text-sm font-medium', on ? 'border-gold-400 bg-gold-500/20 text-gold-200' : 'border-white/15 text-white/80 hover:bg-white/10')}>{children}</button>
);
const SectionLabel = ({ children }: { children: React.ReactNode }) => <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{children}</div>;
const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center bg-moss-950 p-6 text-white">{children}</div>;
const Msg = ({ title, text }: { title: string; text?: string }) => (
  <div className="max-w-md text-center"><div className="text-2xl font-bold">{title}</div>{text && <p className="mt-2 text-white/60">{text}</p>}</div>
);
