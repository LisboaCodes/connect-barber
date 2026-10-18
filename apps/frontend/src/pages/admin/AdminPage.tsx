import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, CheckCircle2, CreditCard, DollarSign, ExternalLink, LayoutDashboard, Search, TrendingUp, Users } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, PageLoader, Pagination, Section, Select, StatCard, Switch, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { adminApi } from '@/lib/api/admin';
import { billingApi } from '@/lib/api/billing';
import { errorMessage } from '@/lib/api/client';
import { fmtDate, fmtDateTime, fmtPhone, fmtRelative, money, num, ROLE_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/auth.store';

const PLAN_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'BLOCKED', 'CANCELLED'];
const statusLabel = (s: string) => (s === 'CANCELLED' ? 'Cancelado' : STATUS_LABEL[s] ?? s);

function StatusPill({ status }: { status: string }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>{statusLabel(status)}</span>;
}

function usePlanNames() {
  const { data } = useQuery({ queryKey: ['public-plans'], queryFn: billingApi.plans, staleTime: 5 * 60_000 });
  const plans = [{ code: 'TRIAL', name: 'Teste grátis', maxProfessionals: 999 }, ...(data ?? [])];
  return { plans, name: (code: string) => plans.find((p) => p.code === code)?.name ?? code };
}

// ---------------- visão geral ----------------
function Overview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-overview'], queryFn: adminApi.overview });
  if (isLoading) return <PageLoader />;
  if (isError || !data) return <EmptyState icon={AlertTriangle} title="Não foi possível carregar a visão geral" />;
  const total = data.byStatus.reduce((s, b) => s + b.count, 0) || 1;
  return (
    <div>
      <PageHeader title="Visão geral da plataforma" description="Indicadores de todas as barbearias do Connect Barber." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Barbearias" value={num(data.tenants)} icon={Building2} />
        <StatCard label="Usuários" value={num(data.users)} icon={Users} />
        <StatCard label="MRR" value={money(data.mrr)} icon={TrendingUp} hint="Planos ativos" />
        <StatCard label="Agendamentos (30d)" value={num(data.appointmentsLast30d)} icon={CalendarDays} />
        <StatCard label="GMV (30d)" value={money(data.gmvLast30d)} icon={DollarSign} hint="Comandas fechadas" />
        <StatCard label="Faturas em aberto" value={money(data.openInvoices.amount)} icon={CreditCard} hint={`${data.openInvoices.count} fatura(s)`} />
      </div>
      <Section title="Barbearias por status" className="mt-6">
        {data.byStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma barbearia cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {data.byStatus.map((b) => (
              <Link key={b.status} to={`barbearias?status=${b.status}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-muted/50">
                <div className="w-32">
                  <StatusPill status={b.status} />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(b.count / total) * 100}%` }} />
                </div>
                <div className="w-12 text-right text-sm font-semibold">{b.count}</div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------- lista ----------------
function TenantList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const searchParam = params.get('search') ?? '';
  const { name: planName } = usePlanNames();

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchParam) {
        const next = new URLSearchParams(params);
        if (search) next.set('search', search);
        else next.delete('search');
        next.delete('page');
        setParams(next, { replace: true });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search, searchParam, params, setParams]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-tenants', searchParam, status, page],
    queryFn: () => adminApi.tenants({ search: searchParam || undefined, status: status || undefined, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title="Barbearias" description={data ? `${data.total} barbearia(s) encontrada(s)` : 'Todas as barbearias cadastradas na plataforma.'} />
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <Input prefix={<Search className="h-4 w-4" />} placeholder="Buscar por nome, endereço (slug) ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={status} onChange={(e) => setParam('status', e.target.value)} className="sm:w-48">
          <option value="">Todos os status</option>
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </Card>
      <Card className={cn(isFetching && 'opacity-70')}>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhuma barbearia encontrada" className="m-4" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Barbearia</TH>
                <TH>Cidade</TH>
                <TH>Plano</TH>
                <TH>Status</TH>
                <TH className="text-right">Prof.</TH>
                <TH className="text-right">Clientes</TH>
                <TH className="text-right">Agend.</TH>
                <TH>Cadastro</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <Link to={t.id} className="font-medium hover:text-primary hover:underline">
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      /{t.slug}
                      {!t.isActive && <span className="ml-2 text-red-600">inativa</span>}
                      {t.onboardingStep < 9 && <span className="ml-2 text-amber-600">onboarding {t.onboardingStep}/5</span>}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{t.addressCity ? `${t.addressCity}${t.addressState ? `/${t.addressState}` : ''}` : '-'}</TD>
                  <TD className="whitespace-nowrap">{planName(t.planCode)}</TD>
                  <TD>
                    <StatusPill status={t.planStatus} />
                    {t.planStatus === 'TRIAL' && t.trialEndsAt && <div className="mt-0.5 text-xs text-muted-foreground">até {fmtDate(t.trialEndsAt)}</div>}
                  </TD>
                  <TD className="text-right">{t._count.professionals}</TD>
                  <TD className="text-right">{t._count.clients}</TD>
                  <TD className="text-right">{t._count.appointments}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(t.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {data && <Pagination className="mt-4" page={data.page} pages={data.pages} total={data.total} onChange={(p) => setParam('page', String(p))} />}
    </div>
  );
}

// ---------------- detalhe ----------------
interface AdminTenantDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  addressCity: string | null;
  addressState: string | null;
  planCode: string;
  planStatus: string;
  trialEndsAt: string | null;
  planRenewsAt: string | null;
  maxProfessionals: number;
  isActive: boolean;
  onboardingStep: number;
  createdAt: string;
  memberships: { id: string; role: string; isActive?: boolean; user: { id: string; name: string; email: string; lastLoginAt: string | null } }[];
  invoices: { id: string; planCode: string; amount: number | string; periodStart: string; periodEnd: string; dueDate: string; status: string; paidAt: string | null; checkoutUrl: string | null }[];
  stats: { orders: number; gmv: number; lastAppointmentAt: string | null };
}

function TenantDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { plans, name: planName } = usePlanNames();
  const { data: t, isLoading, isError } = useQuery({ queryKey: ['admin-tenant', id], queryFn: () => adminApi.tenant(id) as Promise<AdminTenantDetail> });
  const [form, setForm] = useState({ planCode: '', planStatus: '', maxProfessionals: '', isActive: true });
  const [extend, setExtend] = useState('7');
  const [payId, setPayId] = useState<string | null>(null);

  useEffect(() => {
    if (t) setForm({ planCode: t.planCode, planStatus: t.planStatus, maxProfessionals: String(t.maxProfessionals ?? ''), isActive: t.isActive });
  }, [t]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-tenant', id] });
    qc.invalidateQueries({ queryKey: ['admin-tenants'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.updateTenant(id, body),
    onSuccess: () => {
      refresh();
      toast.success('Barbearia atualizada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) => adminApi.payInvoice(invoiceId),
    onSuccess: () => {
      setPayId(null);
      refresh();
      toast.success('Fatura marcada como paga e plano ativado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !t)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Barbearia não encontrada"
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/barbearias">Voltar</Link>
          </Button>
        }
      />
    );

  const save = () => {
    const body: Record<string, unknown> = {};
    if (form.planCode !== t.planCode) body.planCode = form.planCode;
    if (form.planStatus !== t.planStatus) body.planStatus = form.planStatus;
    if (form.isActive !== t.isActive) body.isActive = form.isActive;
    const max = Number(form.maxProfessionals);
    if (!body.planCode && max > 0 && max !== t.maxProfessionals) body.maxProfessionals = max;
    if (Object.keys(body).length === 0) return toast.info('Nenhuma alteração para salvar');
    update.mutate(body);
  };

  return (
    <div>
      <Link to="/admin/barbearias" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Barbearias
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.name} <StatusPill status={t.planStatus} />
            {!t.isActive && <Badge variant="destructive">Inativa</Badge>}
          </span>
        }
        description={
          <>
            /{t.slug} · {t.email ?? 'sem e-mail'} · {fmtPhone(t.phone)} · cadastrada em {fmtDate(t.createdAt)}
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={`/b/${t.slug}`} target="_blank" rel="noreferrer">
              Ver site <ExternalLink />
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Comandas fechadas" value={num(t.stats.orders)} />
        <StatCard label="GMV total" value={money(t.stats.gmv)} />
        <StatCard label="Último agendamento" value={t.stats.lastAppointmentAt ? fmtRelative(t.stats.lastAppointmentAt) : '-'} hint={t.stats.lastAppointmentAt ? fmtDateTime(t.stats.lastAppointmentAt) : undefined} />
        <StatCard label="Plano" value={planName(t.planCode)} hint={t.planStatus === 'TRIAL' ? `Teste até ${fmtDate(t.trialEndsAt)}` : t.planRenewsAt ? `Renova em ${fmtDate(t.planRenewsAt)}` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Plano e acesso" description="Alterações aplicadas imediatamente na barbearia.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plano">
              <Select value={form.planCode} onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))}>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.planStatus} onChange={(e) => setForm((f) => ({ ...f, planStatus: e.target.value }))}>
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Máx. de profissionais" hint={form.planCode !== t.planCode ? 'Definido pelo novo plano' : '999 = ilimitado'}>
              <Input type="number" min={1} value={form.maxProfessionals} disabled={form.planCode !== t.planCode} onChange={(e) => setForm((f) => ({ ...f, maxProfessionals: e.target.value }))} />
            </Field>
            <Field label="Barbearia ativa">
              <label className="flex h-9 items-center gap-3">
                <Switch checked={form.isActive} onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))} />
                <span className="text-sm text-muted-foreground">{form.isActive ? 'Ativa' : 'Desativada'}</span>
              </label>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} loading={update.isPending}>
              Salvar alterações
            </Button>
          </div>
          <div className="mt-6 border-t pt-4">
            <div className="text-sm font-medium">Estender teste grátis</div>
            <p className="text-xs text-muted-foreground">Atual: {t.trialEndsAt ? fmtDate(t.trialEndsAt) : 'sem data'}. Os dias são somados à data de término atual.</p>
            <div className="mt-2 flex gap-2">
              <Input type="number" min={1} max={365} value={extend} onChange={(e) => setExtend(e.target.value)} suffix="dias" className="w-36" />
              <Button
                variant="outline"
                disabled={!(Number(extend) > 0) || update.isPending}
                onClick={() => update.mutate({ extendTrialDays: Number(extend), ...(t.planStatus !== 'TRIAL' && t.planStatus !== 'ACTIVE' ? { planStatus: 'TRIAL' } : {}) })}
              >
                Estender
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Equipe" description={`${t.memberships.length} usuário(s) com acesso`}>
          {t.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro.</p>
          ) : (
            <ul className="divide-y">
              {t.memberships.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.user.email} · último acesso {m.user.lastLoginAt ? fmtRelative(m.user.lastLoginAt) : 'nunca'}
                    </div>
                  </div>
                  <Badge variant={m.role === 'OWNER' ? 'default' : 'outline'}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  {m.isActive === false && <Badge variant="destructive">inativo</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Faturas" className="mt-6">
        {t.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fatura.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Plano</TH>
                <TH>Período</TH>
                <TH>Vencimento</TH>
                <TH className="text-right">Valor</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {t.invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>{planName(inv.planCode)}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {fmtDate(inv.periodStart)} a {fmtDate(inv.periodEnd)}
                  </TD>
                  <TD className="whitespace-nowrap">{fmtDate(inv.dueDate)}</TD>
                  <TD className="text-right font-medium">{money(inv.amount)}</TD>
                  <TD>
                    <StatusPill status={inv.status} />
                    {inv.paidAt && <div className="mt-0.5 text-xs text-muted-foreground">em {fmtDate(inv.paidAt)}</div>}
                  </TD>
                  <TD className="text-right">
                    {(inv.status === 'OPEN' || inv.status === 'OVERDUE') && (
                      <Button size="sm" variant="success" onClick={() => setPayId(inv.id)}>
                        <CheckCircle2 /> Marcar paga
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <ConfirmDialog
        open={!!payId}
        onOpenChange={(o) => !o && setPayId(null)}
        title="Marcar fatura como paga?"
        description="O plano da fatura será ativado e a data de renovação atualizada para o fim do período."
        confirmText="Confirmar pagamento"
        loading={pay.isPending}
        onConfirm={() => {
          if (payId) pay.mutate(payId);
        }}
      />
    </div>
  );
}

// ---------------- layout ----------------
export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const current = useAuthStore((s) => s.current);
  const nav = [
    { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
    { to: '/admin/barbearias', label: 'Barbearias', icon: Building2, end: false },
  ];
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 bg-gray-950 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-2 font-bold">
            <img src="/logo-dark.png" alt="Connect Barber" className="h-10 w-auto" />
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">Admin</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white', isActive && 'bg-white/10 text-white')}>
                <n.icon className="h-4 w-4" />
                <span className="hidden md:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-gray-400 lg:inline">{user?.name}</span>
            <Button size="sm" variant="ghost" className="text-gray-300 hover:bg-white/10 hover:text-white" asChild>
              <Link to={current ? '/app' : '/'}>
                <ArrowLeft /> <span className="hidden sm:inline">Voltar ao painel</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="barbearias" element={<TenantList />} />
          <Route path="barbearias/:id" element={<TenantDetail />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
