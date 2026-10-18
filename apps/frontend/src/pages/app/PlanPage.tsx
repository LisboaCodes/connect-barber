import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, CreditCard, ExternalLink, Info, Lightbulb, RefreshCw, Users, X } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, PageLoader, Section, StatCard, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { billingApi, PlanDef } from '@/lib/api/billing';
import { errorMessage } from '@/lib/api/client';
import { fmtDate, money, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/auth.store';

const statusVariant = (s: string) => (s === 'ACTIVE' ? 'success' : s === 'TRIAL' ? 'warning' : s === 'PAST_DUE' ? 'warning' : 'destructive') as 'success' | 'warning' | 'destructive';

export default function PlanPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const invoiceParam = params.get('invoice');
  const role = useAuthStore((s) => s.current?.role);
  const updateCurrentTenant = useAuthStore((s) => s.updateCurrentTenant);
  const isOwner = role === 'OWNER';
  const [confirm, setConfirm] = useState<PlanDef | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ['billing'], queryFn: billingApi.overview });

  const subscribe = useMutation({
    mutationFn: (code: string) => billingApi.subscribe(code),
    onSuccess: (r) => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['billing'] });
      if (r.checkoutUrl) {
        window.open(r.checkoutUrl, '_blank', 'noopener');
        toast.success('Fatura gerada! Abrimos o pagamento em uma nova aba.');
      } else {
        toast.info('Fatura gerada. Nossa equipe vai entrar em contato para combinar o pagamento.', { duration: 8000 });
      }
    },
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível gerar a fatura')),
  });

  // sincroniza o status do plano no store (libera o painel após pagamento)
  const planStatus = data?.status;
  useEffect(() => {
    if (planStatus) updateCurrentTenant({ planStatus });
  }, [planStatus, updateCurrentTenant]);

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar seu plano"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  const returnedInvoice = invoiceParam ? data.invoices.find((i) => i.id === invoiceParam) : undefined;
  const openInvoice = data.invoices.find((i) => i.status === 'OPEN' || i.status === 'OVERDUE');
  const isTrial = data.status === 'TRIAL' || data.plan.code === 'TRIAL';

  return (
    <div>
      <PageHeader title="Meu plano" description="Assinatura do Connect Barber, faturas e pagamentos." />

      {invoiceParam && (
        <div className={cn('mb-6 flex items-start gap-3 rounded-xl border p-4', returnedInvoice?.status === 'PAID' ? 'border-emerald-200 bg-emerald-50' : 'border-sky-200 bg-sky-50')}>
          {returnedInvoice?.status === 'PAID' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />}
          <div className="flex-1 text-sm">
            {returnedInvoice?.status === 'PAID' ? (
              <>
                <div className="font-semibold text-emerald-900">Pagamento confirmado!</div>
                <div className="text-emerald-800">Seu plano {data.plan.name} está ativo{data.renewsAt ? ` até ${fmtDate(data.renewsAt)}` : ''}. Obrigado!</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-sky-900">Estamos processando seu pagamento</div>
                <div className="text-sky-800">A confirmação pode levar alguns minutos. Atualize esta página em instantes para ver o status da fatura.</div>
              </>
            )}
          </div>
          <div className="flex gap-1">
            {returnedInvoice?.status !== 'PAID' && (
              <Button size="sm" variant="outline" onClick={() => refetch()} loading={isFetching}>
                <RefreshCw /> Atualizar
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={() => setParams({}, { replace: true })} aria-label="Fechar aviso">
              <X />
            </Button>
          </div>
        </div>
      )}

      {(data.status === 'PAST_DUE' || data.status === 'BLOCKED' || (isTrial && data.trialDaysLeft === 0)) && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <div className="font-semibold text-red-900">{isTrial ? 'Seu período de teste terminou' : data.status === 'BLOCKED' ? 'Acesso bloqueado por falta de pagamento' : 'Sua fatura está em atraso'}</div>
            <div className="text-red-800">Escolha um plano abaixo ou pague a fatura em aberto para continuar usando todas as funcionalidades.</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plano atual" value={data.plan.name} icon={CreditCard} hint={isTrial ? 'Todas as funcionalidades liberadas' : `${money(data.plan.promoPrice)}/mês`} />
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-2">
            <Badge variant={statusVariant(data.status)} className="text-sm">
              {STATUS_LABEL[data.status] ?? data.status}
            </Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{data.renewsAt ? `Renova em ${fmtDate(data.renewsAt)}` : isTrial && data.trialEndsAt ? `Teste até ${fmtDate(data.trialEndsAt)}` : ' '}</div>
        </Card>
        <StatCard label="Dias de teste restantes" value={isTrial && data.trialDaysLeft !== null ? data.trialDaysLeft : '-'} icon={CalendarClock} hint={isTrial ? 'Grátis, sem cartão' : 'Teste encerrado'} />
        <StatCard label="Profissionais ativos" value={data.activeProfessionals} icon={Users} hint={data.plan.maxProfessionals >= 999 ? 'Sem limite no plano' : `Limite do plano: ${data.plan.maxProfessionals}`} />
      </div>

      {data.suggestedPlan && data.suggestedPlan.code !== data.plan.code && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-primary/40 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            Com <strong>{data.activeProfessionals}</strong> profissional(is) ativo(s), o plano ideal é o <strong>{data.suggestedPlan.name}</strong> por <strong>{money(data.suggestedPlan.promoPrice)}/mês</strong>.
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => setConfirm(data.suggestedPlan)}>
              Assinar {data.suggestedPlan.name}
            </Button>
          )}
        </div>
      )}

      {openInvoice && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
          <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 text-sm">
            Fatura {openInvoice.status === 'OVERDUE' ? <strong className="text-red-600">vencida</strong> : 'em aberto'} de <strong>{money(openInvoice.amount)}</strong> com vencimento em {fmtDate(openInvoice.dueDate)}.
            {!openInvoice.checkoutUrl && <span className="text-muted-foreground"> O pagamento será combinado com nossa equipe.</span>}
          </div>
          {openInvoice.checkoutUrl && (
            <Button size="sm" asChild>
              <a href={openInvoice.checkoutUrl} target="_blank" rel="noreferrer">
                Pagar agora <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      )}

      <h2 className="mb-1 mt-10 text-lg font-semibold">Planos</h2>
      <p className="mb-5 text-sm text-muted-foreground">Todas as funcionalidades em todos os planos. O valor muda apenas pelo número de profissionais ativos.{!isOwner && ' Somente o dono da barbearia pode alterar o plano.'}</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {data.plans.map((p) => {
          const isCurrent = p.code === data.plan.code && !isTrial;
          const suggested = p.code === data.suggestedPlan?.code;
          const tooSmall = data.activeProfessionals > p.maxProfessionals;
          return (
            <Card key={p.code} className={cn('relative flex flex-col p-6', isCurrent && 'border-primary ring-1 ring-primary', suggested && !isCurrent && 'border-primary/50')}>
              <Badge className="absolute -top-3 left-5" variant="secondary">
                30% OFF
              </Badge>
              {isCurrent ? (
                <span className="absolute -top-3 right-5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Plano atual</span>
              ) : suggested ? (
                <span className="absolute -top-3 right-5 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">Recomendado</span>
              ) : null}
              <div className="text-sm font-semibold text-muted-foreground">{p.name}</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-bold">{money(p.promoPrice)}</span>
                <span className="mb-1 text-sm text-muted-foreground">/mês</span>
              </div>
              <div className="text-sm text-muted-foreground line-through">{money(p.monthlyPrice)}/mês</div>
              <p className="mt-3 flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p.description}
              </p>
              <p className="mt-1 flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p.maxProfessionals >= 999 ? `${p.minProfessionals}+ profissionais` : p.minProfessionals === p.maxProfessionals ? `${p.maxProfessionals} profissional` : `De ${p.minProfessionals} a ${p.maxProfessionals} profissionais`}
              </p>
              {tooSmall && <p className="mt-3 text-xs text-red-600">Você tem {data.activeProfessionals} profissionais ativos; este plano permite até {p.maxProfessionals}.</p>}
              <div className="flex-1" />
              <Button className="mt-6 w-full" variant={isCurrent ? 'outline' : suggested ? 'default' : 'outline'} disabled={!isOwner || tooSmall || subscribe.isPending} onClick={() => setConfirm(p)}>
                {isCurrent ? (openInvoice?.planCode === p.code ? 'Gerar link de pagamento' : 'Renovar') : isTrial || data.plan.code === 'TRIAL' ? 'Assinar' : 'Trocar para este'}
              </Button>
            </Card>
          );
        })}
      </div>

      <Section title="Faturas" description="Histórico dos últimos 24 meses." className="mt-10">
        {data.invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma fatura gerada ainda.</p>
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
              {data.invoices.map((inv) => (
                <TR key={inv.id} className={cn(inv.id === invoiceParam && 'bg-amber-50')}>
                  <TD className="font-medium">{data.plans.find((p) => p.code === inv.planCode)?.name ?? inv.planCode}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {fmtDate(inv.periodStart)} a {fmtDate(inv.periodEnd)}
                  </TD>
                  <TD className="whitespace-nowrap">{fmtDate(inv.dueDate)}</TD>
                  <TD className="text-right font-medium">{money(inv.amount)}</TD>
                  <TD>
                    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_COLOR[inv.status] ?? 'bg-gray-100 text-gray-700')}>{inv.status === 'PAID' ? 'Paga' : inv.status === 'CANCELLED' ? 'Cancelada' : STATUS_LABEL[inv.status] ?? inv.status}</span>
                    {inv.paidAt && <div className="mt-0.5 text-xs text-muted-foreground">em {fmtDate(inv.paidAt)}</div>}
                  </TD>
                  <TD className="text-right">
                    {(inv.status === 'OPEN' || inv.status === 'OVERDUE') && inv.checkoutUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={inv.checkoutUrl} target="_blank" rel="noreferrer">
                          Pagar <ExternalLink />
                        </a>
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      {!data.onlinePayments && <p className="mt-4 text-xs text-muted-foreground">O pagamento on-line ainda não está habilitado: ao assinar, a fatura é gerada e nossa equipe entra em contato para combinar o pagamento.</p>}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `Assinar o plano ${confirm.name}?` : ''}
        description={confirm ? `Será gerada uma fatura de ${money(confirm.promoPrice)} referente ao próximo mês. Uma fatura em aberto de outro plano será cancelada.` : undefined}
        confirmText="Gerar fatura"
        loading={subscribe.isPending}
        onConfirm={() => {
          if (confirm) subscribe.mutate(confirm.code);
        }}
      />
    </div>
  );
}
