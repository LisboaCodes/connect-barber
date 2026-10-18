import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, CalendarPlus, Coins, MessageCircle, Package, Pencil, Receipt, Star, Trash2, TrendingUp, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  PageLoader,
  StatCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { AdjustPointsDialog } from '@/components/clients/AdjustPointsDialog';
import { errorMessage } from '@/lib/api/client';
import { clientsApi, dateOnly } from '@/lib/api/clients';
import { PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL, fmtDate, fmtDateTime, fmtPhone, fmtRelative, money, num, toISODate, whatsappLink } from '@/lib/utils/format';
import { useIsStaff } from '@/store/auth.store';

const LOYALTY_LABEL: Record<string, string> = { EARN: 'Ganho', REDEEM: 'Resgate', ADJUST: 'Ajuste', EXPIRE: 'Expirado' };
const KIND_LABEL: Record<string, string> = {
  CONFIRMATION: 'Confirmação',
  REMINDER: 'Lembrete',
  CANCELLATION: 'Cancelamento',
  RETURN: 'Retorno',
  BIRTHDAY: 'Aniversário',
  CAMPAIGN: 'Campanha',
  WAITLIST: 'Lista de espera',
  SURVEY: 'Pesquisa',
  LOYALTY: 'Fidelidade',
  OTHER: 'Outro',
};
const MSG_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  SENT: { label: 'Enviada', variant: 'success' },
  DELIVERED: { label: 'Entregue', variant: 'success' },
  READ: { label: 'Lida', variant: 'success' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
};
const GENDER: Record<string, string> = { M: 'Masculino', F: 'Feminino', O: 'Outro' };

const birth = (s: string | null) => {
  const d = dateOnly(s);
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function ClientDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isStaff = useIsStaff();
  const [editOpen, setEditOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: c, isLoading, error } = useQuery({ queryKey: ['client', id], queryFn: () => clientsApi.get(id), enabled: !!id });
  const { data: h, isLoading: loadingHistory } = useQuery({ queryKey: ['client', id, 'history'], queryFn: () => clientsApi.history(id), enabled: !!id });

  const del = useMutation({
    mutationFn: () => clientsApi.remove(id),
    onSuccess: () => {
      toast.success('Cliente excluído');
      qc.invalidateQueries({ queryKey: ['clients'] });
      navigate('/app/clientes');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (error || !c)
    return (
      <EmptyState
        icon={UserX}
        title="Cliente não encontrado"
        description={error ? errorMessage(error) : undefined}
        action={
          <Button asChild variant="outline">
            <Link to="/app/clientes">Voltar para clientes</Link>
          </Button>
        }
      />
    );

  const firstName = c.name.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={c.avatarUrl} name={c.name} size="xl" color="#d97706" />
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                {c.name}
                {c.blocked && <Badge variant="destructive">Bloqueado</Badge>}
                {c.club && <Badge variant="warning">{c.club.name}</Badge>}
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{fmtPhone(c.phone)}</span>
                {c.email && <span>{c.email}</span>}
                <span>Cliente desde {fmtDate(c.createdAt)}</span>
              </div>
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/app/agenda?date=${toISODate()}&clientId=${c.id}`}>
                <CalendarPlus /> Novo agendamento
              </Link>
            </Button>
            {c.phone && (
              <Button asChild variant="success">
                <a href={whatsappLink(c.phone, `Olá, ${firstName}!`)} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Editar
            </Button>
            {isStaff && (
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Excluir
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Visitas" value={num(c.visitsCount)} icon={CalendarCheck} />
        <StatCard label="Total gasto" value={money(c.totalSpent)} icon={TrendingUp} hint={c.visitsCount ? `Ticket médio ${money(Number(c.totalSpent) / c.visitsCount)}` : undefined} />
        <StatCard
          label="Pontos"
          value={num(c.loyaltyPoints)}
          icon={Coins}
          hint={
            isStaff ? (
              <button className="font-medium text-primary hover:underline" onClick={() => setPointsOpen(true)}>
                Ajustar pontos
              </button>
            ) : undefined
          }
        />
        <StatCard label="Última visita" value={c.lastVisitAt ? fmtDate(c.lastVisitAt) : 'Nunca'} hint={c.lastVisitAt ? fmtRelative(c.lastVisitAt) : undefined} icon={Star} />
        <StatCard label="Faltas (no-show)" value={num(c.noShowCount)} icon={UserX} className={c.noShowCount > 0 ? 'border-rose-200' : ''} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Nascimento" value={birth(c.birthDate)} />
            <Info label="Gênero" value={c.gender ? GENDER[c.gender] ?? c.gender : '-'} />
            <Info label="Profissional preferido" value={c.preferredProfessional?.name ?? '-'} />
            <Info label="Clube" value={c.club ? `${c.club.name}${c.clubSince ? ` (desde ${fmtDate(c.clubSince)})` : ''}` : '-'} />
            <Info label="Recebe mensagens" value={c.marketingOptIn ? 'Sim' : 'Não'} />
            <Info label="Origem" value={c.source ?? '-'} />
            {c.notes && (
              <div>
                <div className="text-xs text-muted-foreground">Observações</div>
                <p className="whitespace-pre-wrap">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Pacotes ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!c.packages?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum pacote ativo.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {c.packages.map((p) => (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{p.package.name}</div>
                      <span className="text-xs text-muted-foreground">{money(p.pricePaid)}</span>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      Comprado em {fmtDate(p.purchasedAt)}
                      {p.expiresAt ? ` · vence em ${fmtDate(p.expiresAt)}` : ''}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {p.items.map((it) => {
                        const total = Number(it.totalQty ?? 0);
                        const used = Number(it.usedQty ?? 0);
                        return (
                          <li key={it.id} className="flex justify-between">
                            <span>{it.service?.name ?? it.product?.name ?? 'Item'}</span>
                            <span className={total - used > 0 ? 'font-medium' : 'text-muted-foreground'}>
                              {total - used} de {total} restante(s)
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="appointments" className="p-4">
          <TabsList>
            <TabsTrigger value="appointments">Agendamentos ({h?.appointments.length ?? 0})</TabsTrigger>
            <TabsTrigger value="orders">Comandas ({h?.orders.length ?? 0})</TabsTrigger>
            <TabsTrigger value="loyalty">Fidelidade ({h?.loyalty.length ?? 0})</TabsTrigger>
            <TabsTrigger value="messages">Mensagens ({h?.messages.length ?? 0})</TabsTrigger>
          </TabsList>
          {loadingHistory ? (
            <PageLoader label="Carregando histórico..." />
          ) : (
            <>
              <TabsContent value="appointments">
                {!h?.appointments.length ? (
                  <EmptyState icon={CalendarCheck} title="Sem agendamentos" />
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Data</TH>
                        <TH>Serviços</TH>
                        <TH className="hidden sm:table-cell">Profissional</TH>
                        <TH>Status</TH>
                        <TH className="text-right">Valor</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {h.appointments.map((a) => (
                        <TR key={a.id}>
                          <TD className="whitespace-nowrap">{fmtDateTime(a.startAt)}</TD>
                          <TD>{a.services.map((s) => s.service.name).join(', ') || '-'}</TD>
                          <TD className="hidden sm:table-cell">
                            {a.professional && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.professional.color }} />
                                {a.professional.name}
                              </span>
                            )}
                          </TD>
                          <TD>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[a.status] ?? ''}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
                          </TD>
                          <TD className="text-right">{money(a.totalPrice)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="orders">
                {!h?.orders.length ? (
                  <EmptyState icon={Receipt} title="Sem comandas" />
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Comanda</TH>
                        <TH>Data</TH>
                        <TH className="hidden md:table-cell">Itens</TH>
                        <TH className="hidden sm:table-cell">Pagamento</TH>
                        <TH>Status</TH>
                        <TH className="text-right">Total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {h.orders.map((o) => (
                        <TR key={o.id} className="cursor-pointer" onClick={() => navigate(`/app/comandas/${o.id}`)}>
                          <TD className="font-medium">#{o.number}</TD>
                          <TD className="whitespace-nowrap">{fmtDate(o.closedAt ?? o.openedAt)}</TD>
                          <TD className="hidden max-w-xs truncate md:table-cell">{o.items.map((i) => i.description ?? i.name).join(', ')}</TD>
                          <TD className="hidden sm:table-cell">{[...new Set(o.payments.map((p) => PAYMENT_LABEL[p.method] ?? p.method))].join(', ') || '-'}</TD>
                          <TD>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status] ?? ''}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                          </TD>
                          <TD className="text-right font-medium">{money(o.total)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="loyalty">
                {isStaff && (
                  <div className="mb-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setPointsOpen(true)}>
                      <Coins /> Ajustar pontos
                    </Button>
                  </div>
                )}
                {!h?.loyalty.length ? (
                  <EmptyState icon={Coins} title="Sem movimentação de pontos" />
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Data</TH>
                        <TH>Tipo</TH>
                        <TH>Descrição</TH>
                        <TH className="text-right">Pontos</TH>
                        <TH className="hidden sm:table-cell text-right">Saldo</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {h.loyalty.map((l) => (
                        <TR key={l.id}>
                          <TD className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</TD>
                          <TD>
                            {LOYALTY_LABEL[l.type] ?? l.type}
                            {l.status === 'REQUESTED' && (
                              <Badge variant="warning" className="ml-2">
                                Solicitado
                              </Badge>
                            )}
                          </TD>
                          <TD className="text-muted-foreground">{l.description ?? '-'}</TD>
                          <TD className={`text-right font-medium ${l.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {l.points > 0 ? '+' : ''}
                            {num(l.points)}
                          </TD>
                          <TD className="hidden sm:table-cell text-right">{num(l.balanceAfter)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="messages">
                {!h?.messages.length ? (
                  <EmptyState icon={MessageCircle} title="Nenhuma mensagem enviada" />
                ) : (
                  <ul className="divide-y">
                    {h.messages.map((m) => (
                      <li key={m.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{KIND_LABEL[m.kind] ?? m.kind}</span>
                          <Badge variant="outline">{m.channel === 'WHATSAPP' ? 'WhatsApp' : m.channel === 'EMAIL' ? 'E-mail' : m.channel}</Badge>
                          <Badge variant={MSG_STATUS[m.status]?.variant ?? 'secondary'}>{MSG_STATUS[m.status]?.label ?? m.status}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(m.sentAt ?? m.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{m.content}</p>
                        {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </Card>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={c} />
      <AdjustPointsDialog open={pointsOpen} onOpenChange={setPointsOpen} clientId={c.id} balance={c.loyaltyPoints} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir cliente?"
        description={`${c.name} será removido da sua base. O histórico financeiro é mantido nos relatórios.`}
        confirmText="Excluir"
        variant="destructive"
        loading={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
