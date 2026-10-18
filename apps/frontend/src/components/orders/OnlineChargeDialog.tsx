import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/lib/api/client';
import { Button, Dialog, DialogContent, DialogFooter, Spinner } from '@/components/ui';
import { money } from '@/lib/utils/format';

export interface PaymentIntentDto {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  kind: 'PIX' | 'HOSTED' | 'POS';
  amount: number;
  qrCode: string | null;
  copyPaste: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

const qrSrc = (qr: string | null) => (!qr ? null : qr.startsWith('data:') || qr.startsWith('http') ? qr : `data:image/png;base64,${qr}`);

/** Botões "Pix (QR)" e "Maquininha" para cobrar o saldo da comanda pelas integrações da barbearia */
export function OnlineChargeButtons({ order, onDone, remaining }: { order: { id: string }; onDone: (o: any) => void; remaining: number }) {
  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: () => api.get('/tenant').then((r) => r.data), staleTime: 300_000 });
  const t = tenantQ.data;
  const pix = !!t?.onlinePaymentEnabled && !!t?.integrations?.creativePay;
  const pos = !!t?.posEnabled && !!t?.integrations?.pos;
  const [intent, setIntent] = useState<PaymentIntentDto | null>(null);
  const [open, setOpen] = useState(false);

  const start = useMutation({
    mutationFn: (kind: 'pix' | 'pos') => api.post<PaymentIntentDto>(`/payments/orders/${order.id}/${kind}`, { amount: remaining }).then((r) => r.data),
    onSuccess: (i) => {
      setIntent(i);
      setOpen(true);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!pix && !pos) return null;
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {pix && (
        <Button type="button" variant="outline" size="sm" loading={start.isPending && start.variables === 'pix'} onClick={() => start.mutate('pix')}>
          <QrCode /> Pix com QR code
        </Button>
      )}
      {pos && (
        <Button type="button" variant="outline" size="sm" loading={start.isPending && start.variables === 'pos'} onClick={() => start.mutate('pos')}>
          <CreditCard /> Cobrar na maquininha
        </Button>
      )}
      {intent && (
        <ChargeDialog
          open={open}
          intent={intent}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setIntent(null);
          }}
          onPaid={async () => {
            const { data } = await api.get(`/orders/${order.id}`);
            onDone(data);
          }}
        />
      )}
    </div>
  );
}

/** Acompanha a cobrança até ser paga (consulta a cada 3 s) */
export function ChargeDialog({ open, onOpenChange, intent, onPaid, statusUrl }: { open: boolean; onOpenChange: (o: boolean) => void; intent: PaymentIntentDto; onPaid: () => void | Promise<void>; statusUrl?: string }) {
  const [current, setCurrent] = useState<PaymentIntentDto>(intent);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCurrent(intent), [intent]);

  useEffect(() => {
    if (!open || current.status !== 'PENDING') return;
    const url = statusUrl ?? `/payments/intents/${intent.id}`;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get<PaymentIntentDto>(url);
        setCurrent((c) => ({ ...c, status: data.status }));
        if (data.status === 'PAID') {
          clearInterval(id);
          toast.success('Pagamento confirmado!');
          await onPaid();
          setTimeout(() => onOpenChange(false), 1200);
        }
      } catch {
        /* tenta de novo */
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current.status, intent.id, statusUrl]);

  const cancel = useMutation({
    mutationFn: () => api.post(`/payments/intents/${intent.id}/cancel`),
    onSuccess: () => onOpenChange(false),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const title = current.kind === 'POS' ? 'Cobrança na maquininha' : 'Pagamento por Pix';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title={title} description={`Valor: ${money(current.amount)}`}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          {current.status === 'PAID' ? (
            <div className="rounded-xl bg-emerald-50 p-6 text-emerald-800">
              <div className="text-3xl">✓</div>
              <div className="mt-1 font-semibold">Pagamento confirmado</div>
            </div>
          ) : current.status === 'PENDING' ? (
            current.kind === 'POS' ? (
              <>
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Aguardando o cliente passar o cartão na maquininha…</p>
              </>
            ) : (
              <>
                {qrSrc(current.qrCode) ? <img src={qrSrc(current.qrCode)!} alt="QR code Pix" className="h-52 w-52 rounded-lg border bg-white p-2" /> : <Spinner className="h-8 w-8" />}
                <p className="text-xs text-muted-foreground">Peça ao cliente para escanear o QR code no app do banco.</p>
                {current.copyPaste && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(current.copyPaste!);
                      setCopied(true);
                    }}
                  >
                    {copied ? 'Código copiado' : 'Copiar código Pix'}
                  </Button>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" /> Aguardando pagamento…
                </div>
              </>
            )
          ) : (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Cobrança {current.status === 'EXPIRED' ? 'expirada/cancelada' : 'não concluída'}. Gere uma nova.</div>
          )}
        </div>
        <DialogFooter>
          {current.status === 'PENDING' && (
            <Button type="button" variant="outline" onClick={() => cancel.mutate()} loading={cancel.isPending}>
              Cancelar cobrança
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
