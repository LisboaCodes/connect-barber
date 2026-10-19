import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Clock, Copy, ExternalLink, PartyPopper, Plus, Scissors, Store, Trash2, Users, Zap } from 'lucide-react';
import { Avatar, Badge, Button, Card, Field, Input, MoneyInput, PageLoader, Select, Switch } from '@/components/ui';
import api, { errorMessage } from '@/lib/api/client';
import { UFS, maskPhone } from '@/components/auth/AuthLayout';
import { WEEKDAYS, minutes, money } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/auth.store';

// ---------------- tipos ----------------
type Range = { start: string; end: string };
type Hours = Record<number, Range[]>;

interface TenantData {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  openingHours: Record<string, Range[]> | null;
  onboardingStep: number;
}
interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  price: number | string;
}
interface ProfessionalRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  color: string | null;
  avatarUrl: string | null;
  serviceCommissionPct: number | string;
  workSchedules?: { weekday: number; startTime: string; endTime: string }[];
}

const STEPS = [
  { n: 1, title: 'Barbearia', icon: Store },
  { n: 2, title: 'Serviços', icon: Scissors },
  { n: 3, title: 'Profissionais', icon: Users },
  { n: 4, title: 'Jornada', icon: Clock },
  { n: 5, title: 'Pronto!', icon: PartyPopper },
];

const DEFAULT_HOURS: Hours = { 0: [], 1: [{ start: '09:00', end: '19:00' }], 2: [{ start: '09:00', end: '19:00' }], 3: [{ start: '09:00', end: '19:00' }], 4: [{ start: '09:00', end: '19:00' }], 5: [{ start: '09:00', end: '19:00' }], 6: [{ start: '09:00', end: '17:00' }] };

const SUGGESTIONS = [
  { name: 'Corte', durationMinutes: 30, price: 45 },
  { name: 'Barba', durationMinutes: 25, price: 35 },
  { name: 'Corte + Barba', durationMinutes: 55, price: 75 },
];

const hoursFromTenant = (h: Record<string, Range[]> | null | undefined): Hours => {
  if (!h || !Object.values(h).some((r) => Array.isArray(r) && r.length)) return structuredClone(DEFAULT_HOURS);
  const out: Hours = {};
  for (let d = 0; d <= 6; d++) out[d] = (h[String(d)] ?? []).map((r) => ({ start: r.start, end: r.end }));
  return out;
};

const hoursFromSchedule = (ws: ProfessionalRow['workSchedules']): Hours => {
  const out: Hours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  (ws ?? []).forEach((w) => out[w.weekday].push({ start: w.startTime, end: w.endTime }));
  return out;
};

const validateHours = (h: Hours) => {
  for (let d = 0; d <= 6; d++) {
    for (const r of h[d] ?? []) {
      if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end) || r.start >= r.end) return `Horário inválido em ${WEEKDAYS[d]}: o início deve ser antes do fim.`;
    }
  }
  return null;
};

// ---------------- editor de horários ----------------
function HoursEditor({ value, onChange }: { value: Hours; onChange: (h: Hours) => void }) {
  const set = (d: number, ranges: Range[]) => onChange({ ...value, [d]: ranges });
  return (
    <div className="divide-y rounded-lg border">
      {WEEKDAYS.map((label, d) => {
        const ranges = value[d] ?? [];
        const open = ranges.length > 0;
        return (
          <div key={d} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
            <label className="flex w-36 shrink-0 items-center gap-3 pt-1.5">
              <Switch checked={open} onCheckedChange={(c) => set(d, c ? [{ start: '09:00', end: '18:00' }] : [])} />
              <span className={cn('text-sm font-medium', !open && 'text-muted-foreground')}>{label}</span>
            </label>
            <div className="flex flex-1 flex-col gap-2">
              {!open && <span className="pt-1.5 text-sm text-muted-foreground">Fechado</span>}
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" className="w-28" value={r.start} onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <span className="text-sm text-muted-foreground">às</span>
                  <Input type="time" className="w-28" value={r.end} onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => set(d, ranges.filter((_, j) => j !== i))} aria-label="Remover intervalo">
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {open && (
                <button
                  type="button"
                  className="self-start text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    const last = ranges[ranges.length - 1];
                    set(d, [...ranges, { start: last?.end && last.end < '20:00' ? '14:00' : '13:00', end: '19:00' }]);
                  }}
                >
                  + adicionar intervalo
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepFooter({ onBack, onSkip, onNext, nextLabel = 'Salvar e continuar', loading, disabled }: { onBack?: () => void; onSkip?: () => void; onNext: () => void; nextLabel?: string; loading?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center">
      {onBack && (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft /> Voltar
        </Button>
      )}
      <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
        {onSkip && (
          <Button variant="outline" onClick={onSkip}>
            Pular esta etapa
          </Button>
        )}
        <Button onClick={onNext} loading={loading} disabled={disabled}>
          {nextLabel} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

// ---------------- passo 1 ----------------
function StepShop({ tenant, onDone, onSkip }: { tenant: TenantData; onDone: () => void; onSkip: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: tenant.name ?? '',
    phone: maskPhone(tenant.phone ?? ''),
    whatsapp: maskPhone(tenant.whatsapp ?? ''),
    addressZip: tenant.addressZip ?? '',
    addressStreet: tenant.addressStreet ?? '',
    addressNumber: tenant.addressNumber ?? '',
    addressComplement: tenant.addressComplement ?? '',
    addressDistrict: tenant.addressDistrict ?? '',
    addressCity: tenant.addressCity ?? '',
    addressState: tenant.addressState ?? '',
  });
  const [hours, setHours] = useState<Hours>(() => hoursFromTenant(tenant.openingHours));
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      if (f.name.trim().length < 2) throw new Error('Informe o nome da barbearia');
      const err = validateHours(hours);
      if (err) throw new Error(err);
      const openingHours: Record<string, Range[]> = {};
      for (let d = 0; d <= 6; d++) openingHours[String(d)] = hours[d] ?? [];
      const body: Record<string, unknown> = { name: f.name.trim(), openingHours };
      (['phone', 'whatsapp', 'addressZip', 'addressStreet', 'addressNumber', 'addressComplement', 'addressDistrict', 'addressCity', 'addressState'] as const).forEach((k) => {
        if (f[k].trim()) body[k] = f[k].trim();
      });
      return (await api.patch('/tenant', body)).data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      useAuthStore.getState().updateCurrentTenant({ name: data?.name ?? f.name.trim() });
      toast.success('Dados da barbearia salvos');
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <h2 className="text-xl font-bold">Dados da barbearia</h2>
      <p className="mt-1 text-sm text-muted-foreground">Essas informações aparecem no site da barbearia e nas mensagens para os clientes.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Nome da barbearia" required className="sm:col-span-2">
          <Input value={f.name} onChange={up('name')} />
        </Field>
        <Field label="Telefone">
          <Input type="tel" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: maskPhone(e.target.value) }))} placeholder="(11) 3333-4444" />
        </Field>
        <Field label="WhatsApp" hint="Usado no botão de contato do site">
          <Input type="tel" value={f.whatsapp} onChange={(e) => setF((s) => ({ ...s, whatsapp: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <h3 className="mt-8 font-semibold">Endereço</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-6">
        <Field label="CEP" className="sm:col-span-2">
          <Input value={f.addressZip} onChange={up('addressZip')} inputMode="numeric" placeholder="00000-000" />
        </Field>
        <Field label="Rua" className="sm:col-span-4">
          <Input value={f.addressStreet} onChange={up('addressStreet')} />
        </Field>
        <Field label="Número" className="sm:col-span-2">
          <Input value={f.addressNumber} onChange={up('addressNumber')} />
        </Field>
        <Field label="Complemento" className="sm:col-span-4">
          <Input value={f.addressComplement} onChange={up('addressComplement')} />
        </Field>
        <Field label="Bairro" className="sm:col-span-2">
          <Input value={f.addressDistrict} onChange={up('addressDistrict')} />
        </Field>
        <Field label="Cidade" className="sm:col-span-3">
          <Input value={f.addressCity} onChange={up('addressCity')} />
        </Field>
        <Field label="UF" className="sm:col-span-1">
          <Select value={f.addressState} onChange={up('addressState')}>
            <option value="">--</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <h3 className="mt-8 font-semibold">Horário de funcionamento</h3>
      <p className="mb-3 text-sm text-muted-foreground">Adicione mais de um intervalo para pausas, como o horário de almoço.</p>
      <HoursEditor value={hours} onChange={setHours} />

      <StepFooter onSkip={onSkip} onNext={() => save.mutate()} loading={save.isPending} />
    </div>
  );
}

// ---------------- passo 2 ----------------
function StepServices({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useQuery({ queryKey: ['services'], queryFn: async () => (await api.get<ServiceRow[]>('/services')).data });
  const [f, setF] = useState<{ name: string; durationMinutes: number; price: number }>({ name: '', durationMinutes: 30, price: 0 });

  const create = useMutation({
    mutationFn: async (s: { name: string; durationMinutes: number; price: number }) => (await api.post('/services', s)).data,
    onSuccess: (_d, s) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(`Serviço "${s.name}" adicionado`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/services/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const has = (name: string) => services.some((s) => s.name.trim().toLowerCase() === name.toLowerCase());

  const add = () => {
    if (f.name.trim().length < 2) return toast.error('Informe o nome do serviço');
    if (!f.durationMinutes || f.durationMinutes < 5) return toast.error('A duração mínima é de 5 minutos');
    create.mutate({ name: f.name.trim(), durationMinutes: Number(f.durationMinutes), price: Number(f.price) || 0 }, { onSuccess: () => setF({ name: '', durationMinutes: 30, price: 0 }) });
  };

  return (
    <div>
      <h2 className="text-xl font-bold">Serviços</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cadastre os serviços que sua barbearia oferece. Você pode ajustar detalhes depois, em Serviços.</p>

      <div className="mt-5 rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4 text-primary" /> Sugestões rápidas
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s.name} size="sm" variant="outline" disabled={has(s.name) || create.isPending} onClick={() => create.mutate(s)}>
              {has(s.name) ? <Check className="text-emerald-600" /> : <Plus />}
              {s.name} · {minutes(s.durationMinutes)} · {money(s.price)}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
        <Field label="Nome do serviço">
          <Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Ex.: Pigmentação" onKeyDown={(e) => e.key === 'Enter' && add()} />
        </Field>
        <Field label="Duração (min)">
          <Input type="number" min={5} step={5} value={f.durationMinutes} onChange={(e) => setF((s) => ({ ...s, durationMinutes: Number(e.target.value) }))} />
        </Field>
        <Field label="Preço">
          <MoneyInput value={f.price} onChange={(v) => setF((s) => ({ ...s, price: v }))} />
        </Field>
        <Button onClick={add} loading={create.isPending}>
          <Plus /> Adicionar
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <PageLoader />
        ) : services.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Scissors className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{minutes(s.durationMinutes)}</div>
                </div>
                <div className="text-sm font-semibold">{money(s.price)}</div>
                <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(s.id)} aria-label="Remover serviço">
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StepFooter onBack={onBack} onSkip={onDone} onNext={onDone} nextLabel="Continuar" disabled={services.length === 0} />
    </div>
  );
}

// ---------------- passo 3 ----------------
function StepProfessionals({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: pros = [], isLoading } = useQuery({ queryKey: ['professionals'], queryFn: async () => (await api.get<ProfessionalRow[]>('/professionals')).data });
  const empty = { name: '', phone: '', email: '', serviceCommissionPct: 40 };
  const [f, setF] = useState(empty);

  const create = useMutation({
    mutationFn: async () => {
      if (f.name.trim().length < 2) throw new Error('Informe o nome do profissional');
      const body: Record<string, unknown> = { name: f.name.trim(), serviceCommissionPct: Math.min(100, Math.max(0, Number(f.serviceCommissionPct) || 0)) };
      if (f.phone.trim()) body.phone = f.phone.trim();
      if (f.email.trim()) body.email = f.email.trim().toLowerCase();
      return (await api.post('/professionals', body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Profissional adicionado');
      setF(empty);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <h2 className="text-xl font-bold">Profissionais</h2>
      <p className="mt-1 text-sm text-muted-foreground">Quem atende na barbearia? Cada profissional tem sua própria agenda e comissão. O acesso ao sistema pode ser criado depois, em Profissionais.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required>
          <Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do profissional" />
        </Field>
        <Field label="Telefone">
          <Input type="tel" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} placeholder="profissional@email.com" />
        </Field>
        <Field label="Comissão sobre serviços (%)">
          <Input type="number" min={0} max={100} value={f.serviceCommissionPct} onChange={(e) => setF((s) => ({ ...s, serviceCommissionPct: Number(e.target.value) }))} suffix="%" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          <Plus /> Adicionar profissional
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <PageLoader />
        ) : pros.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Nenhum profissional cadastrado ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {pros.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <Avatar src={p.avatarUrl} name={p.name} color={p.color ?? undefined} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{[p.phone, p.email].filter(Boolean).join(' · ') || 'Sem contato'}</div>
                </div>
                <Badge variant="secondary">{Number(p.serviceCommissionPct)}% comissão</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StepFooter onBack={onBack} onSkip={onDone} onNext={onDone} nextLabel="Continuar" disabled={pros.length === 0} />
    </div>
  );
}

// ---------------- passo 4 ----------------
function ProfessionalSchedule({ pro, shopHours }: { pro: ProfessionalRow; shopHours: Hours }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<Hours>(() => hoursFromSchedule(pro.workSchedules));
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const err = validateHours(hours);
      if (err) throw new Error(err);
      const ranges = Object.entries(hours).flatMap(([d, rs]) => rs.map((r) => ({ weekday: Number(d), startTime: r.start, endTime: r.end })));
      return (await api.put(`/professionals/${pro.id}/schedule`, { ranges })).data;
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['professionals'] });
      toast.success(`Jornada de ${pro.name} salva`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Avatar src={pro.avatarUrl} name={pro.name} color={pro.color ?? undefined} />
        <div className="flex-1 font-semibold">{pro.name}</div>
        {saved && (
          <Badge variant="success">
            <Check className="mr-1 h-3 w-3" /> Salva
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setHours(structuredClone(shopHours));
            setSaved(false);
          }}
        >
          Copiar horário da barbearia
        </Button>
      </div>
      <HoursEditor
        value={hours}
        onChange={(h) => {
          setHours(h);
          setSaved(false);
        }}
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
          Salvar jornada
        </Button>
      </div>
    </Card>
  );
}

function StepSchedules({ tenant, onBack, onDone }: { tenant: TenantData; onBack: () => void; onDone: () => void }) {
  const { data: pros = [], isLoading } = useQuery({ queryKey: ['professionals'], queryFn: async () => (await api.get<ProfessionalRow[]>('/professionals')).data });
  const shopHours = useMemo(() => hoursFromTenant(tenant.openingHours), [tenant.openingHours]);
  return (
    <div>
      <h2 className="text-xl font-bold">Jornada de trabalho</h2>
      <p className="mt-1 text-sm text-muted-foreground">Defina os dias e horários em que cada profissional atende. A agenda on-line só oferece horários dentro da jornada.</p>
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <PageLoader />
        ) : pros.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Cadastre ao menos um profissional na etapa anterior para definir a jornada.</p>
        ) : (
          pros.map((p) => <ProfessionalSchedule key={p.id} pro={p} shopHours={shopHours} />)
        )}
      </div>
      <StepFooter onBack={onBack} onSkip={onDone} onNext={onDone} nextLabel="Continuar" />
    </div>
  );
}

// ---------------- passo 5 ----------------
function StepDone({ slug, onBack, onFinish, loading }: { slug: string; onBack: () => void; onFinish: () => void; loading: boolean }) {
  const url = `${window.location.origin}/b/${slug}`;
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <PartyPopper className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-2xl font-bold">Tudo pronto!</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">Sua barbearia já está no ar. Compartilhe o link abaixo no Instagram, no WhatsApp e no Google para seus clientes agendarem on-line.</p>
      <div className="mx-auto mt-6 flex max-w-lg flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
        <code className="flex-1 truncate text-left text-sm">{url}</code>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(url).then(
                () => toast.success('Link copiado'),
                () => toast.error('Não foi possível copiar'),
              );
            }}
          >
            <Copy /> Copiar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/b/${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink /> Abrir
            </a>
          </Button>
        </div>
      </div>
      <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left text-sm sm:grid-cols-2">
        {['Personalize o site em Site da barbearia', 'Configure lembretes em Configurações', 'Crie o acesso da equipe em Profissionais', 'Teste grátis por 30 dias, sem limitação'].map((t) => (
          <div key={t} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft /> Voltar
        </Button>
        <Button size="lg" onClick={onFinish} loading={loading}>
          Ir para o painel <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

// ---------------- página ----------------
export default function OnboardingPage() {
  const navigate = useNavigate();
  const current = useAuthStore((s) => s.current);
  const updateCurrentTenant = useAuthStore((s) => s.updateCurrentTenant);
  const { data: tenant, isLoading, isError } = useQuery({ queryKey: ['tenant'], queryFn: async () => (await api.get<TenantData>('/tenant')).data });
  const [step, setStep] = useState<number>(() => {
    const s = current?.tenant.onboardingStep ?? 1;
    return s >= 1 && s <= 5 ? s : 1;
  });
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const persistStep = (n: number) => {
    updateCurrentTenant({ onboardingStep: n });
    api.patch('/tenant', { onboardingStep: n }).catch(() => undefined);
  };

  const goTo = (n: number) => {
    setStep(n);
    // só avança o progresso salvo (não regride ao voltar)
    if (n > (current?.tenant.onboardingStep ?? 0) && n <= 5) persistStep(n);
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await api.patch('/tenant', { onboardingStep: 9 });
      useAuthStore.getState().updateCurrentTenant({ onboardingStep: 9 });
      toast.success('Configuração inicial concluída!');
      navigate('/app', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const slug = tenant?.slug ?? current?.tenant.slug ?? '';

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-gray-950 text-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <Link to="/app" className="flex items-center">
            <img src="/logo.png?v=20261018" alt="Connect Barber" className="h-10 w-10 rounded-lg bg-white p-1" />
          </Link>
          <span className="hidden text-sm text-gray-400 sm:inline">· Configuração inicial</span>
          <Button variant="ghost" size="sm" className="ml-auto text-gray-300 hover:bg-white/10 hover:text-white" asChild>
            <Link to="/app">Fazer depois</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {/* stepper */}
        <ol className="mb-6 grid grid-cols-5 gap-1 sm:gap-2">
          {STEPS.map((s) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <li key={s.n}>
                <button type="button" onClick={() => setStep(s.n)} className="flex w-full flex-col items-center gap-1.5 text-center">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors', done && 'border-primary bg-primary text-primary-foreground', active && 'border-primary bg-background text-primary', !done && !active && 'border-border bg-background text-muted-foreground')}>
                    {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </span>
                  <span className={cn('text-[11px] font-medium sm:text-xs', active ? 'text-foreground' : 'text-muted-foreground')}>{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>

        <Card className="p-5 sm:p-8">
          {isLoading ? (
            <PageLoader />
          ) : isError || !tenant ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar os dados da barbearia.{' '}
              <Link to="/app" className="text-primary hover:underline">
                Ir para o painel
              </Link>
            </div>
          ) : step === 1 ? (
            <StepShop tenant={tenant} onDone={() => goTo(2)} onSkip={() => goTo(2)} />
          ) : step === 2 ? (
            <StepServices onBack={() => setStep(1)} onDone={() => goTo(3)} />
          ) : step === 3 ? (
            <StepProfessionals onBack={() => setStep(2)} onDone={() => goTo(4)} />
          ) : step === 4 ? (
            <StepSchedules tenant={tenant} onBack={() => setStep(3)} onDone={() => goTo(5)} />
          ) : (
            <StepDone slug={slug} onBack={() => setStep(4)} onFinish={finish} loading={finishing} />
          )}
        </Card>
      </div>
    </div>
  );
}
