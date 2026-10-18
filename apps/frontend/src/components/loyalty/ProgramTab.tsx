import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Dialog, DialogContent, DialogFooter, EmptyState, Field, Input, MoneyInput, PageLoader, Select, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { loyaltyApi, type LoyaltyProgram, type LoyaltyReward, type RewardInput } from '@/lib/api/loyalty';
import { money, num } from '@/lib/utils/format';

type RewardKind = 'service' | 'product' | 'discount';

export function ProgramTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['loyalty', 'program'], queryFn: loyaltyApi.program });
  const [form, setForm] = useState<Partial<LoyaltyProgram>>({});
  const [reward, setReward] = useState<(RewardInput & { id?: string; kind: RewardKind }) | null>(null);
  const [removing, setRemoving] = useState<LoyaltyReward | null>(null);

  const services = useQuery({ queryKey: ['services', 'lite'], queryFn: loyaltyApi.services, enabled: !!reward });
  const products = useQuery({ queryKey: ['products', 'lite'], queryFn: loyaltyApi.products, enabled: !!reward });

  useEffect(() => {
    if (data) setForm({ isActive: data.isActive, name: data.name, pointsPerCurrency: Number(data.pointsPerCurrency), includeProducts: data.includeProducts, pointsExpireDays: data.pointsExpireDays, description: data.description ?? '' });
  }, [data]);

  const saveProgram = useMutation({
    mutationFn: () => loyaltyApi.updateProgram({ isActive: form.isActive, name: form.name, pointsPerCurrency: Number(form.pointsPerCurrency) || 0, includeProducts: form.includeProducts, pointsExpireDays: form.pointsExpireDays || null, description: form.description || undefined }),
    onSuccess: () => {
      toast.success('Programa salvo');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveReward = useMutation({
    mutationFn: () => {
      const r = reward!;
      const payload: RewardInput = { name: r.name.trim(), pointsCost: Number(r.pointsCost), isActive: r.isActive ?? true, serviceId: r.kind === 'service' ? r.serviceId || null : null, productId: r.kind === 'product' ? r.productId || null : null, discountAmount: r.kind === 'discount' ? Number(r.discountAmount) || null : null };
      return r.id ? loyaltyApi.updateReward(r.id, payload) : loyaltyApi.createReward(payload);
    },
    onSuccess: () => {
      toast.success('Prêmio salvo');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
      setReward(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const removeReward = useMutation({
    mutationFn: (id: string) => loyaltyApi.removeReward(id),
    onSuccess: () => {
      toast.success('Prêmio removido');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
      setRemoving(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (error) return <Card className="p-4 text-sm text-red-700">{errorMessage(error)}</Card>;
  if (isLoading || !data) return <PageLoader />;

  const set = <K extends keyof LoyaltyProgram>(k: K, v: LoyaltyProgram[K]) => setForm((f) => ({ ...f, [k]: v }));
  const example = 100 * (Number(form.pointsPerCurrency) || 0);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Configuração</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.isActive} onCheckedChange={(v) => set('isActive', v)} disabled={!canManage} />
            {form.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveProgram.mutate();
            }}
          >
            <Field label="Nome do programa">
              <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} disabled={!canManage} maxLength={80} />
            </Field>
            <Field label="Pontos por R$ 1,00 gasto" hint={`Ex.: uma comanda de R$ 100,00 gera ${num(example)} ponto(s).`}>
              <Input type="number" min={0} step="0.1" value={form.pointsPerCurrency ?? ''} onChange={(e) => set('pointsPerCurrency', Number(e.target.value))} disabled={!canManage} />
            </Field>
            <Field label="Validade dos pontos (dias)" hint="Deixe em branco para não expirar.">
              <Input type="number" min={1} value={form.pointsExpireDays ?? ''} onChange={(e) => set('pointsExpireDays', e.target.value ? Number(e.target.value) : null)} disabled={!canManage} />
            </Field>
            <label className="flex items-center justify-between gap-2 text-sm">
              Pontuar também a venda de produtos
              <Switch checked={!!form.includeProducts} onCheckedChange={(v) => set('includeProducts', v)} disabled={!canManage} />
            </label>
            <Field label="Regulamento / descrição">
              <Textarea rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} disabled={!canManage} maxLength={1000} />
            </Field>
            {canManage && (
              <Button type="submit" loading={saveProgram.isPending} className="w-full">
                Salvar programa
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Prêmios</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setReward({ name: '', pointsCost: 100, kind: 'service', isActive: true })}>
              <Plus /> Novo prêmio
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!data.rewards.length ? (
            <EmptyState icon={Gift} title="Nenhum prêmio cadastrado" description="Cadastre prêmios para seus clientes trocarem os pontos." />
          ) : (
            <ul className="divide-y">
              {data.rewards.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {r.name}
                      {!r.isActive && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.service ? `Serviço: ${r.service.name}` : r.product ? `Produto: ${r.product.name}` : r.discountAmount ? `Desconto de ${money(r.discountAmount)}` : '-'}</div>
                  </div>
                  <Badge variant="warning" className="tabular-nums">
                    {num(r.pointsCost)} pts
                  </Badge>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => setReward({ id: r.id, name: r.name, pointsCost: r.pointsCost, serviceId: r.serviceId, productId: r.productId, discountAmount: r.discountAmount !== null ? Number(r.discountAmount) : null, isActive: r.isActive, kind: r.serviceId ? 'service' : r.productId ? 'product' : 'discount' })}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="text-red-600" title="Excluir" onClick={() => setRemoving(r)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reward} onOpenChange={(o) => !o && setReward(null)}>
        <DialogContent size="sm" title={reward?.id ? 'Editar prêmio' : 'Novo prêmio'}>
          {reward && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (reward.name.trim().length < 2) return toast.error('Informe o nome do prêmio');
                if (!reward.pointsCost || reward.pointsCost < 1) return toast.error('Informe os pontos necessários');
                if (reward.kind === 'service' && !reward.serviceId) return toast.error('Selecione o serviço');
                if (reward.kind === 'product' && !reward.productId) return toast.error('Selecione o produto');
                if (reward.kind === 'discount' && !reward.discountAmount) return toast.error('Informe o valor do desconto');
                saveReward.mutate();
              }}
            >
              <Field label="Nome" required>
                <Input autoFocus value={reward.name} onChange={(e) => setReward({ ...reward, name: e.target.value })} placeholder="Ex.: Corte grátis" />
              </Field>
              <Field label="Pontos necessários" required>
                <Input type="number" min={1} value={reward.pointsCost} onChange={(e) => setReward({ ...reward, pointsCost: Number(e.target.value) })} />
              </Field>
              <Field label="Tipo de prêmio">
                <Select value={reward.kind} onChange={(e) => setReward({ ...reward, kind: e.target.value as RewardKind })}>
                  <option value="service">Serviço grátis</option>
                  <option value="product">Produto grátis</option>
                  <option value="discount">Desconto em R$</option>
                </Select>
              </Field>
              {reward.kind === 'service' && (
                <Field label="Serviço">
                  <Select value={reward.serviceId ?? ''} onChange={(e) => setReward({ ...reward, serviceId: e.target.value })}>
                    <option value="">Selecione...</option>
                    {services.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({money(s.price)})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {reward.kind === 'product' && (
                <Field label="Produto">
                  <Select value={reward.productId ?? ''} onChange={(e) => setReward({ ...reward, productId: e.target.value })}>
                    <option value="">Selecione...</option>
                    {products.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({money(s.salePrice)})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {reward.kind === 'discount' && (
                <Field label="Valor do desconto">
                  <MoneyInput value={reward.discountAmount ?? ''} onChange={(v) => setReward({ ...reward, discountAmount: v })} />
                </Field>
              )}
              <label className="flex items-center justify-between text-sm">
                Disponível para resgate
                <Switch checked={reward.isActive ?? true} onCheckedChange={(v) => setReward({ ...reward, isActive: v })} />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReward(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saveReward.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Excluir prêmio?" description={removing?.name} confirmText="Excluir" variant="destructive" loading={removeReward.isPending} onConfirm={() => { if (removing) removeReward.mutate(removing.id); }} />
    </div>
  );
}
