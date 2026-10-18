import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter, Field, Select, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { catalogApi } from '@/lib/api/appointments';
import { ordersApi, type OrderKind } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { ClientSearch, clientPayload, type ClientPick } from '@/components/agenda/ClientSearch';

export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isPro = useAuthStore((s) => s.current?.role === 'PROFESSIONAL');
  const ownProId = useAuthStore((s) => s.current?.professionalId ?? '');
  const [kind, setKind] = useState<OrderKind>('CLIENT');
  const [client, setClient] = useState<ClientPick | null>(null);
  const [professionalId, setProfessionalId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind('CLIENT');
    setClient(null);
    setProfessionalId(isPro ? ownProId : '');
    setNotes('');
  }, [open, isPro, ownProId]);

  const prosQ = useQuery({ queryKey: ['professionals'], queryFn: catalogApi.professionals, enabled: open, staleTime: 120_000 });
  const pros = (prosQ.data ?? []).filter((p) => p.isActive !== false);

  const create = useMutation({
    mutationFn: () =>
      ordersApi.open({
        kind,
        ...(kind === 'CLIENT' ? clientPayload(client) : {}),
        professionalId: professionalId || undefined,
        notes: notes || undefined,
      }),
    onSuccess: (o) => {
      toast.success(`Comanda #${o.number} aberta`);
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-summary'] });
      onOpenChange(false);
      navigate(`/app/comandas/${o.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const valid = kind === 'CLIENT' || !!professionalId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Nova comanda">
        <Tabs value={kind} onValueChange={(v) => setKind(v as OrderKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="CLIENT" className="flex-1">
              Cliente
            </TabsTrigger>
            <TabsTrigger value="PROFESSIONAL_CONSUMPTION" className="flex-1">
              Consumo do profissional
            </TabsTrigger>
          </TabsList>
          <TabsContent value="CLIENT" className="space-y-4">
            <Field label="Cliente" hint="Opcional: venda avulsa sem cadastro também é permitida">
              <ClientSearch value={client} onChange={setClient} />
            </Field>
          </TabsContent>
          <TabsContent value="PROFESSIONAL_CONSUMPTION">
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Registra produtos consumidos/retirados pelo profissional. Baixa o estoque, não gera comissão nem entra no caixa.
            </p>
          </TabsContent>
        </Tabs>
        <Field label="Profissional" required={kind !== 'CLIENT'}>
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={isPro}>
            <option value="">{kind === 'CLIENT' ? 'Nenhum (definir nos itens)' : 'Selecione'}</option>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid} loading={create.isPending}>
            Abrir comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewOrderDialog;
