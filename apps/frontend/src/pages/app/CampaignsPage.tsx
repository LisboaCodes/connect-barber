import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Eye, Mail, Megaphone, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, PageHeader, Skeleton, StatCard } from '@/components/ui';
import { CampaignFormDialog } from '@/components/campaigns/CampaignFormDialog';
import { CampaignDetailDialog } from '@/components/campaigns/CampaignDetailDialog';
import { errorMessage } from '@/lib/api/client';
import { campaignsApi, CAMPAIGN_STATUS_LABEL, type Campaign, type CampaignStatus } from '@/lib/api/campaigns';
import { fmtDateTime, num } from '@/lib/utils/format';

const STATUS_VARIANT: Record<CampaignStatus, 'secondary' | 'warning' | 'success' | 'outline' | 'default'> = {
  DRAFT: 'secondary',
  SCHEDULED: 'warning',
  SENDING: 'default',
  SENT: 'success',
  CANCELLED: 'outline',
};

type Action = { kind: 'send' | 'cancel' | 'remove'; campaign: Campaign } | null;

function audienceSummary(c: Campaign) {
  const a = c.audience;
  if (!a || a.all) return 'Todos os clientes';
  const parts: string[] = [];
  if (a.tags?.length) parts.push(`etiquetas: ${a.tags.join(', ')}`);
  if (a.clubId) parts.push('membros de clube');
  if (a.inactiveDays) parts.push(`inativos há ${a.inactiveDays}+ dias`);
  if (a.birthdayMonth) parts.push(`aniversariantes do mês ${a.birthdayMonth}`);
  if (a.professionalId) parts.push('por profissional');
  if (a.minVisits) parts.push(`${a.minVisits}+ visitas`);
  return parts.join(' · ') || 'Todos os clientes';
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['campaigns', 'list'], queryFn: campaignsApi.list });

  const run = useMutation({
    mutationFn: ({ kind, campaign }: NonNullable<Action>) => (kind === 'send' ? campaignsApi.send(campaign.id) : kind === 'cancel' ? campaignsApi.cancel(campaign.id) : campaignsApi.remove(campaign.id)),
    onSuccess: (res, v) => {
      if (v.kind === 'send') toast.success(`Campanha enviada para ${num((res as Campaign).totalSent)} de ${num((res as Campaign).totalRecipients)} cliente(s)`);
      else toast.success(v.kind === 'cancel' ? 'Campanha cancelada' : 'Campanha excluída');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
      setAction(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const list = data ?? [];
  const sent = list.filter((c) => c.status === 'SENT');
  const totalSent = sent.reduce((s, c) => s + c.totalSent, 0);
  const totalRead = sent.reduce((s, c) => s + c.totalRead, 0);

  const openForm = (c?: Campaign) => {
    setEditing(c ?? null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Notícias e promoções enviadas por WhatsApp e e-mail."
        className="mb-0"
        actions={
          <Button onClick={() => openForm()}>
            <Plus /> Nova campanha
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Campanhas" value={num(list.length)} />
        <StatCard label="Agendadas" value={num(list.filter((c) => c.status === 'SCHEDULED').length)} />
        <StatCard label="Mensagens enviadas" value={num(totalSent)} />
        <StatCard label="Leituras" value={num(totalRead)} hint={totalSent ? `${num((totalRead / totalSent) * 100, 0)}% de leitura` : undefined} />
      </div>

      {error ? (
        <Card className="p-4 text-sm text-red-700">{errorMessage(error)}</Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !list.length ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha ainda"
          description="Avise seus clientes sobre promoções, novidades e horários livres. Filtre por etiqueta, clube, inativos ou aniversariantes."
          action={
            <Button onClick={() => openForm()}>
              <Plus /> Criar primeira campanha
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const editable = c.status === 'DRAFT' || c.status === 'SCHEDULED' || c.status === 'CANCELLED';
            return (
              <Card key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetailId(c.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.title}</span>
                    <Badge variant={STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
                    {c.channels.includes('WHATSAPP') && <MessageCircle className="h-4 w-4 text-emerald-600" />}
                    {c.channels.includes('EMAIL') && <Mail className="h-4 w-4 text-sky-600" />}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{c.content}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {audienceSummary(c)} · {num(c.totalRecipients)} destinatário(s)
                    {c.status === 'SENT' && ` · ${num(c.totalSent)} enviadas · ${num(c.totalRead)} lidas`}
                    {c.status === 'SCHEDULED' && c.scheduledAt && ` · agendada para ${fmtDateTime(c.scheduledAt)}`}
                    {c.status === 'SENT' && c.sentAt && ` · ${fmtDateTime(c.sentAt)}`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {editable && (
                    <Button size="sm" onClick={() => setAction({ kind: 'send', campaign: c })}>
                      <Send /> Enviar agora
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDetailId(c.id)}>
                        <Eye /> Ver detalhes
                      </DropdownMenuItem>
                      {editable && (
                        <DropdownMenuItem onSelect={() => openForm(c)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                      )}
                      {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                        <DropdownMenuItem onSelect={() => setAction({ kind: 'cancel', campaign: c })}>
                          <Ban /> Cancelar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setAction({ kind: 'remove', campaign: c })}>
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CampaignFormDialog open={formOpen} onOpenChange={setFormOpen} campaign={editing} />
      <CampaignDetailDialog id={detailId} onOpenChange={(o) => !o && setDetailId(null)} />
      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && !run.isPending && setAction(null)}
        title={action?.kind === 'send' ? 'Enviar campanha agora?' : action?.kind === 'cancel' ? 'Cancelar campanha?' : 'Excluir campanha?'}
        description={
          action?.kind === 'send'
            ? `"${action.campaign.title}" será enviada para aproximadamente ${num(action.campaign.totalRecipients)} cliente(s). O envio pode levar alguns minutos e não pode ser desfeito.`
            : action?.kind === 'cancel'
              ? 'O agendamento será cancelado. Você poderá editar e enviar depois.'
              : 'A campanha e seu histórico de destinatários serão excluídos.'
        }
        confirmText={action?.kind === 'send' ? 'Enviar' : action?.kind === 'cancel' ? 'Cancelar campanha' : 'Excluir'}
        cancelText="Voltar"
        variant={action?.kind === 'remove' ? 'destructive' : 'default'}
        loading={run.isPending}
        onConfirm={() => {
          if (action) run.mutate(action);
        }}
      />
    </div>
  );
}
