import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Mail, MessageCircle, MessagesSquare, XCircle } from 'lucide-react';
import { Badge, Card, Dialog, DialogContent, EmptyState, PageHeader, Pagination, Select, Skeleton, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL, MESSAGE_STATUS_LABEL, messagesApi, type MessageLog, type MessageStatus } from '@/lib/api/messages';
import { cn } from '@/lib/utils/cn';
import { fmtDateTime } from '@/lib/utils/format';
import { useIsManager } from '@/store/auth.store';

const STATUS_VARIANT: Record<MessageStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'warning',
  SENT: 'secondary',
  DELIVERED: 'outline',
  READ: 'success',
  FAILED: 'destructive',
};

function ProviderCard({ label, icon: Icon, enabled }: { label: string; icon: React.ComponentType<{ className?: string }>; enabled: boolean }) {
  return (
    <Card className={cn('flex items-center gap-3 p-4', enabled ? '' : 'border-amber-200 bg-amber-50/60')}>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{enabled ? 'Provedor configurado e enviando' : 'Provedor não configurado: mensagens ficam apenas registradas'}</div>
      </div>
      {enabled ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-amber-600" />}
    </Card>
  );
}

export default function MessagesPage() {
  const isManager = useIsManager();
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<MessageLog | null>(null);

  useEffect(() => setPage(1), [kind, status]);

  const q = { kind: kind || undefined, status: status || undefined, page, limit: 50 };
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ['messages', q], queryFn: () => messagesApi.list(q), placeholderData: keepPreviousData });

  return (
    <div className="space-y-6">
      <PageHeader title="Mensagens" description="Histórico de WhatsApp e e-mails enviados automaticamente e por campanhas." className="mb-0" />

      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ProviderCard label="WhatsApp" icon={MessageCircle} enabled={data.providers.whatsapp} />
          <ProviderCard label="E-mail" icon={Mail} enabled={data.providers.email} />
        </div>
      )}
      {data && (!data.providers.whatsapp || !data.providers.email) && isManager && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Os provedores de envio são configurados pela plataforma. Os modelos e lembretes automáticos podem ser ajustados em{' '}
          <Link to="/app/configuracoes" className="font-medium text-primary hover:underline">
            Configurações
          </Link>
          .
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-48">
          <option value="">Todos os tipos</option>
          {Object.entries(MESSAGE_KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">Todos os status</option>
          {Object.entries(MESSAGE_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      <Card className={cn(isFetching && 'opacity-80')}>
        {error ? (
          <div className="p-6 text-sm text-red-700">{errorMessage(error)}</div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState icon={MessagesSquare} title="Nenhuma mensagem encontrada" description="Confirmações, lembretes, campanhas e pesquisas enviadas aparecem aqui." className="m-4 border-0" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Data</TH>
                <TH>Cliente</TH>
                <TH className="hidden sm:table-cell">Canal</TH>
                <TH>Tipo</TH>
                <TH className="hidden lg:table-cell">Conteúdo</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((m) => (
                <TR key={m.id} className="cursor-pointer" onClick={() => setOpen(m)}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(m.createdAt)}</TD>
                  <TD>
                    <div className="font-medium">{m.client?.name ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">{m.recipient}</div>
                  </TD>
                  <TD className="hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-sm">
                      {m.channel === 'WHATSAPP' ? <MessageCircle className="h-4 w-4 text-emerald-600" /> : m.channel === 'EMAIL' ? <Mail className="h-4 w-4 text-sky-600" /> : null}
                      {CHANNEL_LABEL[m.channel] ?? m.channel}
                    </span>
                  </TD>
                  <TD>
                    <Badge variant="outline">{MESSAGE_KIND_LABEL[m.kind] ?? m.kind}</Badge>
                  </TD>
                  <TD className="hidden max-w-sm truncate text-muted-foreground lg:table-cell">{m.subject ? `${m.subject} — ` : ''}{m.content}</TD>
                  <TD>
                    <Badge variant={STATUS_VARIANT[m.status]}>{MESSAGE_STATUS_LABEL[m.status] ?? m.status}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {data && <Pagination page={page} pages={data.pages} total={data.total} onChange={setPage} />}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent size="md" title={open ? `${MESSAGE_KIND_LABEL[open.kind] ?? open.kind} · ${CHANNEL_LABEL[open.channel] ?? open.channel}` : ''} description={open ? `Para ${open.client?.name ?? open.recipient} (${open.recipient})` : undefined}>
          {open && (
            <div className="space-y-4 text-sm">
              {open.subject && (
                <div>
                  <div className="text-xs text-muted-foreground">Assunto</div>
                  <div className="font-medium">{open.subject}</div>
                </div>
              )}
              <div className={cn('whitespace-pre-wrap rounded-lg p-3', open.channel === 'WHATSAPP' ? 'bg-emerald-50' : 'bg-muted/50')}>{open.content}</div>
              {open.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Erro: {open.error}</div>}
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={STATUS_VARIANT[open.status]}>{MESSAGE_STATUS_LABEL[open.status]}</Badge>
                </dd>
                <dt className="text-muted-foreground">Criada</dt>
                <dd>{fmtDateTime(open.createdAt)}</dd>
                <dt className="text-muted-foreground">Enviada</dt>
                <dd>{fmtDateTime(open.sentAt)}</dd>
                <dt className="text-muted-foreground">Entregue</dt>
                <dd>{fmtDateTime(open.deliveredAt)}</dd>
                <dt className="text-muted-foreground">Lida</dt>
                <dd>{fmtDateTime(open.readAt)}</dd>
              </dl>
              {open.clientId && (
                <Link to={`/app/clientes/${open.clientId}`} className="inline-block text-sm font-medium text-primary hover:underline">
                  Ver cliente
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
