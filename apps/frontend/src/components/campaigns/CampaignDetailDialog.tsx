import { useQuery } from '@tanstack/react-query';
import { Badge, Dialog, DialogContent, PageLoader, StatCard, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { campaignsApi, CAMPAIGN_STATUS_LABEL } from '@/lib/api/campaigns';
import { CHANNEL_LABEL } from '@/lib/api/messages';
import { fmtDateTime, num, pct } from '@/lib/utils/format';

export function CampaignDetailDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['campaigns', 'detail', id], queryFn: () => campaignsApi.get(id!), enabled: !!id });
  const failed = data?.recipients.filter((r) => r.error).length ?? 0;

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title={data?.title ?? 'Campanha'} description={data ? `${CAMPAIGN_STATUS_LABEL[data.status]} · ${data.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(' + ')}${data.sentAt ? ` · enviada em ${fmtDateTime(data.sentAt)}` : data.scheduledAt ? ` · agendada para ${fmtDateTime(data.scheduledAt)}` : ''}` : undefined}>
        {isLoading || !data ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Público" value={num(data.totalRecipients)} />
              <StatCard label="Enviadas" value={num(data.totalSent)} hint={data.totalRecipients ? pct((data.totalSent / data.totalRecipients) * 100, 0) : undefined} />
              <StatCard label="Lidas" value={num(data.totalRead)} hint={data.totalSent ? pct((data.totalRead / data.totalSent) * 100, 0) : undefined} />
              <StatCard label="Falhas" value={num(failed)} />
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Mensagem</div>
              <p className="whitespace-pre-wrap text-sm">{data.content}</p>
            </div>
            {data.recipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border scrollbar-thin">
                <Table>
                  <THead>
                    <TR>
                      <TH>Cliente</TH>
                      <TH className="hidden sm:table-cell">Contato</TH>
                      <TH>Status</TH>
                      <TH className="hidden md:table-cell">Data</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.recipients.map((r) => (
                      <TR key={r.id}>
                        <TD>{r.client.name}</TD>
                        <TD className="hidden text-xs text-muted-foreground sm:table-cell">{[r.client.phone, r.client.email].filter(Boolean).join(' · ')}</TD>
                        <TD>
                          {r.error ? (
                            <Badge variant="destructive" title={r.error}>
                              Falhou
                            </Badge>
                          ) : r.readAt ? (
                            <Badge variant="success">Lida</Badge>
                          ) : r.sentAt ? (
                            <Badge variant="secondary">Enviada</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                          {r.error && <div className="mt-0.5 max-w-xs truncate text-xs text-red-600">{r.error}</div>}
                        </TD>
                        <TD className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{fmtDateTime(r.readAt ?? r.sentAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
