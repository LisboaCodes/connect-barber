import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, KeyRound, RefreshCw, Smartphone, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/lib/api/client';
import { Button, Field, Input, Section, Switch } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';

interface TenantLike {
  id: string;
  slug: string;
  onlinePaymentEnabled: boolean;
  requirePrepayment: boolean;
  kioskEnabled: boolean;
  posEnabled: boolean;
  posProvider: string | null;
  integrations?: { creativePay: boolean; creativePayLast4: string | null; creativePayWebhookSecret: boolean; pos: boolean; posDeviceId: string | null; kioskToken: string | null };
}

/** Configurações de pagamento online (CreativePay da barbearia), maquininha (Mercado Pago Point) e totem */
export default function PaymentsKioskSettings({ tenant }: { tenant: TenantLike }) {
  const qc = useQueryClient();
  const updateStore = useAuthStore((s) => s.updateCurrentTenant);
  const [cp, setCp] = useState({ onlinePaymentEnabled: tenant.onlinePaymentEnabled, requirePrepayment: tenant.requirePrepayment, cpApiKey: '', cpWebhookSecret: '' });
  const [pos, setPos] = useState({ posEnabled: tenant.posEnabled, posAccessToken: '', posDeviceId: tenant.integrations?.posDeviceId ?? '' });
  const [kiosk, setKiosk] = useState({ kioskEnabled: tenant.kioskEnabled });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch('/tenant', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Configurações salvas');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const regen = useMutation({
    mutationFn: () => api.post<{ kioskToken: string }>('/tenant/kiosk-token').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      setKiosk({ kioskEnabled: true });
      toast.success('Token do totem gerado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const webhookUrl = `${apiBase.startsWith('http') ? apiBase : window.location.origin + apiBase}/payments/webhooks/creative-pay/${tenant.id}`;
  const kioskUrl = tenant.integrations?.kioskToken ? `${window.location.origin}/totem/${tenant.slug}?k=${tenant.integrations.kioskToken}` : null;
  const copy = (v: string, msg = 'Copiado') => {
    navigator.clipboard?.writeText(v);
    toast.success(msg);
  };

  return (
    <div className="space-y-6">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Pagamento online (CreativePay)
          </span>
        }
        description="Seus clientes pagam por Pix ou cartão no agendamento online, no totem e na área do cliente. O dinheiro cai na conta da sua barbearia no CreativePay."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <div className="font-medium">Como configurar</div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
              <li>
                Crie sua conta em{' '}
                <a href="https://pay.creativenext.cloud" target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                  pay.creativenext.cloud
                </a>{' '}
                e cadastre uma <strong>Aplicação de API</strong>.
              </li>
              <li>Cole abaixo a chave de API e o segredo do webhook da aplicação.</li>
              <li>
                No CreativePay, informe a URL do webhook:{' '}
                <button type="button" className="font-mono text-xs underline" onClick={() => copy(webhookUrl, 'URL do webhook copiada')}>
                  {webhookUrl}
                </button>
              </li>
            </ol>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-xs text-muted-foreground">{tenant.integrations?.creativePay ? `Chave configurada (final ${tenant.integrations.creativePayLast4})` : 'Nenhuma chave configurada'}</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              Ativo <Switch checked={cp.onlinePaymentEnabled} onCheckedChange={(v) => setCp((s) => ({ ...s, onlinePaymentEnabled: v }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chave de API (X-API-Key)" hint={tenant.integrations?.creativePay ? 'Deixe em branco para manter a atual' : undefined}>
              <Input type="password" placeholder="creativepay_…" value={cp.cpApiKey} onChange={(e) => setCp((s) => ({ ...s, cpApiKey: e.target.value }))} />
            </Field>
            <Field label="Segredo do webhook" hint={tenant.integrations?.creativePayWebhookSecret ? 'Já configurado; deixe em branco para manter' : 'Usado para validar as notificações de pagamento'}>
              <Input type="password" value={cp.cpWebhookSecret} onChange={(e) => setCp((s) => ({ ...s, cpWebhookSecret: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Exigir pagamento no agendamento online</div>
              <div className="text-xs text-muted-foreground">O horário só fica garantido depois do pagamento. Reduz faltas.</div>
            </div>
            <Switch checked={cp.requirePrepayment} onCheckedChange={(v) => setCp((s) => ({ ...s, requirePrepayment: v }))} />
          </div>
          <div className="flex justify-end">
            <Button
              loading={save.isPending}
              onClick={() =>
                save.mutate({
                  onlinePaymentEnabled: cp.onlinePaymentEnabled,
                  requirePrepayment: cp.requirePrepayment,
                  ...(cp.cpApiKey.trim() ? { cpApiKey: cp.cpApiKey.trim() } : {}),
                  ...(cp.cpWebhookSecret.trim() ? { cpWebhookSecret: cp.cpWebhookSecret.trim() } : {}),
                })
              }
            >
              Salvar pagamento online
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Maquininha (Mercado Pago Point)
          </span>
        }
        description="Envie a cobrança da comanda direto para a maquininha, pelo painel ou pelo totem. Funciona com Point Smart e Point Pro 2 em modo PDV."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            No painel de desenvolvedor do Mercado Pago, crie uma aplicação, gere o <strong>Access Token de produção</strong> e ative o modo PDV da maquininha. O ID do aparelho aparece em Integrações › Point.
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-xs text-muted-foreground">{tenant.integrations?.pos ? `Aparelho ${tenant.integrations.posDeviceId}` : 'Não configurada'}</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              Ativa <Switch checked={pos.posEnabled} onCheckedChange={(v) => setPos((s) => ({ ...s, posEnabled: v }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Access Token" hint={tenant.integrations?.pos ? 'Deixe em branco para manter' : undefined}>
              <Input type="password" placeholder="APP_USR-…" value={pos.posAccessToken} onChange={(e) => setPos((s) => ({ ...s, posAccessToken: e.target.value }))} />
            </Field>
            <Field label="ID do aparelho (device_id)">
              <Input placeholder="PAX_A910__SMARTPOS…" value={pos.posDeviceId} onChange={(e) => setPos((s) => ({ ...s, posDeviceId: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              loading={save.isPending}
              onClick={() =>
                save.mutate({
                  posEnabled: pos.posEnabled,
                  posProvider: 'MERCADOPAGO_POINT',
                  posDeviceId: pos.posDeviceId.trim() || null,
                  ...(pos.posAccessToken.trim() ? { posAccessToken: pos.posAccessToken.trim() } : {}),
                })
              }
            >
              Salvar maquininha
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Totem de autoatendimento
          </span>
        }
        description="Um tablet na recepção: o cliente faz check-in (o barbeiro é avisado), paga a comanda por Pix, maquininha ou balcão e já agenda a próxima visita, sem precisar de atendente."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Totem ativo</div>
              <div className="text-xs text-muted-foreground">Abra o link abaixo no navegador do tablet e deixe em tela cheia.</div>
            </div>
            <Switch
              checked={kiosk.kioskEnabled}
              onCheckedChange={(v) => {
                setKiosk({ kioskEnabled: v });
                save.mutate({ kioskEnabled: v });
                updateStore({});
              }}
            />
          </div>
          {kioskUrl ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate text-xs">{kioskUrl}</code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(kioskUrl, 'Link do totem copiado')}>
                  <Copy /> Copiar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={kioskUrl} target="_blank" rel="noreferrer">
                    <ExternalLink /> Abrir
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Gere o token para obter o link do totem.</p>
          )}
          <div className="flex justify-end">
            <Button variant="outline" loading={regen.isPending} onClick={() => regen.mutate()}>
              <RefreshCw /> {kioskUrl ? 'Gerar novo link (invalida o atual)' : 'Gerar link do totem'}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
