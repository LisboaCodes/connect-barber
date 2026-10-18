import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Crown, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, DialogFooter, EmptyState, Field, Input, MoneyInput, Skeleton, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { loyaltyApi, type Club } from '@/lib/api/loyalty';
import { money, num } from '@/lib/utils/format';

interface Draft {
  id?: string;
  name: string;
  description: string;
  discountPct: string;
  appliesToServices: boolean;
  appliesToProducts: boolean;
  monthlyFee: number | '';
  isActive: boolean;
}

const toDraft = (c?: Club): Draft =>
  c
    ? { id: c.id, name: c.name, description: c.description ?? '', discountPct: String(Number(c.discountPct)), appliesToServices: c.appliesToServices, appliesToProducts: c.appliesToProducts, monthlyFee: c.monthlyFee !== null ? Number(c.monthlyFee) : '', isActive: c.isActive }
    : { name: '', description: '', discountPct: '10', appliesToServices: true, appliesToProducts: false, monthlyFee: '', isActive: true };

export function ClubsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Club | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['loyalty', 'clubs'], queryFn: loyaltyApi.clubs });

  const save = useMutation({
    mutationFn: () => {
      const d = draft!;
      const payload = { name: d.name.trim(), description: d.description || undefined, discountPct: Number(d.discountPct.replace(',', '.')) || 0, appliesToServices: d.appliesToServices, appliesToProducts: d.appliesToProducts, monthlyFee: d.monthlyFee === '' ? null : Number(d.monthlyFee), isActive: d.isActive };
      return d.id ? loyaltyApi.updateClub(d.id, payload) : loyaltyApi.createClub(payload);
    },
    onSuccess: () => {
      toast.success('Clube salvo');
      qc.invalidateQueries({ queryKey: ['loyalty', 'clubs'] });
      setDraft(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => loyaltyApi.removeClub(id),
    onSuccess: () => {
      toast.success('Clube excluído');
      qc.invalidateQueries({ queryKey: ['loyalty', 'clubs'] });
      setRemoving(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Clubes de assinatura dão desconto automático na comanda para os clientes membros. Associe clientes pelo cadastro do cliente.</p>
        {canManage && (
          <Button onClick={() => setDraft(toDraft())}>
            <Plus /> Novo clube
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !data?.length ? (
        <EmptyState icon={Crown} title="Nenhum clube criado" description="Crie um clube (ex.: Clube VIP) com desconto e mensalidade para fidelizar clientes." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className={`p-4 ${c.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Crown className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {c.name} {!c.isActive && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="warning">{num(c.discountPct, 0)}% de desconto</Badge>
                {c.appliesToServices && <Badge variant="outline">Serviços</Badge>}
                {c.appliesToProducts && <Badge variant="outline">Produtos</Badge>}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{c.monthlyFee ? `${money(c.monthlyFee)}/mês` : 'Sem mensalidade'}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {c._count?.clients ?? 0} membro(s)
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => setDraft(toDraft(c))}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-red-600" title="Excluir" onClick={() => setRemoving(c)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent size="md" title={draft?.id ? 'Editar clube' : 'Novo clube'}>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.name.trim().length < 2) return toast.error('Informe o nome do clube');
                const pctN = Number(draft.discountPct.replace(',', '.'));
                if (Number.isNaN(pctN) || pctN < 0 || pctN > 100) return toast.error('Desconto deve ficar entre 0 e 100%');
                save.mutate();
              }}
            >
              <Field label="Nome" required>
                <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Clube VIP" />
              </Field>
              <Field label="Descrição">
                <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desconto (%)" required>
                  <Input inputMode="decimal" value={draft.discountPct} onChange={(e) => setDraft({ ...draft, discountPct: e.target.value })} suffix="%" />
                </Field>
                <Field label="Mensalidade" hint="Opcional">
                  <MoneyInput value={draft.monthlyFee} onChange={(v) => setDraft({ ...draft, monthlyFee: v })} />
                </Field>
              </div>
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <label className="flex items-center justify-between">
                  Desconto em serviços <Switch checked={draft.appliesToServices} onCheckedChange={(v) => setDraft({ ...draft, appliesToServices: v })} />
                </label>
                <label className="flex items-center justify-between">
                  Desconto em produtos <Switch checked={draft.appliesToProducts} onCheckedChange={(v) => setDraft({ ...draft, appliesToProducts: v })} />
                </label>
                <label className="flex items-center justify-between">
                  Clube ativo <Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={save.isPending}>
                  Salvar clube
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Excluir clube?" description={`"${removing?.name}" será excluído e os ${removing?._count?.clients ?? 0} membro(s) perderão o vínculo.`} confirmText="Excluir" variant="destructive" loading={remove.isPending} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}
