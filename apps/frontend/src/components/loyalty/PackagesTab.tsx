import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Globe, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Dialog, DialogContent, DialogFooter, EmptyState, Field, Input, MoneyInput, Select, Skeleton, Switch, Table, TBody, TD, TH, THead, TR, Textarea } from '@/components/ui';
import { ClientSearch } from './ClientSearch';
import { errorMessage } from '@/lib/api/client';
import { loyaltyApi, type ClientLite, type PackageRow } from '@/lib/api/loyalty';
import { fmtDate, money } from '@/lib/utils/format';

interface Draft {
  id?: string;
  name: string;
  description: string;
  price: number | '';
  validityDays: string;
  isActive: boolean;
  sellOnline: boolean;
  items: { ref: string; quantity: number }[]; // ref = "s:<id>" | "p:<id>"
}

const toDraft = (p?: PackageRow): Draft =>
  p
    ? { id: p.id, name: p.name, description: p.description ?? '', price: Number(p.price), validityDays: p.validityDays ? String(p.validityDays) : '', isActive: p.isActive, sellOnline: p.sellOnline, items: p.items.map((i) => ({ ref: i.serviceId ? `s:${i.serviceId}` : `p:${i.productId}`, quantity: i.quantity })) }
    : { name: '', description: '', price: '', validityDays: '90', isActive: true, sellOnline: false, items: [{ ref: '', quantity: 4 }] };

export function PackagesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<PackageRow | null>(null);
  const [client, setClient] = useState<ClientLite | null>(null);
  const [showAll, setShowAll] = useState(false);

  const packages = useQuery({ queryKey: ['loyalty', 'packages', includeInactive], queryFn: () => loyaltyApi.packages(includeInactive) });
  const clientPkgs = useQuery({ queryKey: ['loyalty', 'client-packages', client?.id, showAll], queryFn: () => loyaltyApi.clientPackages({ clientId: client?.id, all: showAll }) });
  const services = useQuery({ queryKey: ['services', 'lite'], queryFn: loyaltyApi.services, enabled: !!draft });
  const products = useQuery({ queryKey: ['products', 'lite'], queryFn: loyaltyApi.products, enabled: !!draft });

  const priceOf = (ref: string) => {
    const [t, id] = ref.split(':');
    if (t === 's') return Number(services.data?.find((s) => s.id === id)?.price ?? 0);
    if (t === 'p') return Number(products.data?.find((s) => s.id === id)?.salePrice ?? 0);
    return 0;
  };

  const save = useMutation({
    mutationFn: () => {
      const d = draft!;
      const payload = {
        name: d.name.trim(),
        description: d.description || undefined,
        price: Number(d.price) || 0,
        validityDays: d.validityDays ? Number(d.validityDays) : null,
        isActive: d.isActive,
        sellOnline: d.sellOnline,
        items: d.items.filter((i) => i.ref).map((i) => (i.ref.startsWith('s:') ? { serviceId: i.ref.slice(2), quantity: i.quantity } : { productId: i.ref.slice(2), quantity: i.quantity })),
      };
      return d.id ? loyaltyApi.updatePackage(d.id, payload) : loyaltyApi.createPackage(payload);
    },
    onSuccess: () => {
      toast.success('Pacote salvo');
      qc.invalidateQueries({ queryKey: ['loyalty', 'packages'] });
      setDraft(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => loyaltyApi.removePackage(id),
    onSuccess: () => {
      toast.success('Pacote desativado');
      qc.invalidateQueries({ queryKey: ['loyalty', 'packages'] });
      setRemoving(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const fullPrice = draft ? draft.items.reduce((s, i) => s + priceOf(i.ref) * i.quantity, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} /> Mostrar inativos
        </label>
        {canManage && (
          <Button onClick={() => setDraft(toDraft())}>
            <Plus /> Novo pacote
          </Button>
        )}
      </div>

      {packages.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !packages.data?.length ? (
        <EmptyState icon={Package} title="Nenhum pacote cadastrado" description="Venda combos de serviços e produtos com desconto, para uso em várias visitas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {packages.data.map((p) => {
            const value = p.items.reduce((s, i) => s + Number(i.service?.price ?? i.product?.salePrice ?? 0) * i.quantity, 0);
            return (
              <Card key={p.id} className={`flex flex-col p-4 ${p.isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.validityDays ? `Validade: ${p.validityDays} dias` : 'Sem validade'}</div>
                  </div>
                  <div className="flex gap-1">
                    {p.sellOnline && (
                      <Badge variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" /> Online
                      </Badge>
                    )}
                    {!p.isActive && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                </div>
                <ul className="mt-3 flex-1 space-y-1 text-sm text-muted-foreground">
                  {p.items.map((i, idx) => (
                    <li key={i.id ?? idx}>
                      {i.quantity}x {i.service?.name ?? i.product?.name}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-lg font-bold">{money(p.price)}</div>
                    {value > Number(p.price) && <div className="text-xs text-muted-foreground line-through">{money(value)}</div>}
                    <div className="text-xs text-muted-foreground">{p._count?.clientPackages ?? 0} vendido(s)</div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => setDraft(toDraft(p))}>
                        <Pencil />
                      </Button>
                      {p.isActive && (
                        <Button size="icon-sm" variant="ghost" className="text-red-600" title="Desativar" onClick={() => setRemoving(p)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pacotes dos clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <ClientSearch value={client} onChange={setClient} placeholder="Filtrar por cliente" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showAll} onCheckedChange={setShowAll} /> Incluir encerrados
            </label>
          </div>
          {clientPkgs.isLoading ? (
            <Skeleton className="h-24" />
          ) : !clientPkgs.data?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pacote vendido{client ? ' para este cliente' : ''}. Pacotes são vendidos pela comanda.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Cliente</TH>
                  <TH>Pacote</TH>
                  <TH>Saldo</TH>
                  <TH className="hidden md:table-cell">Compra</TH>
                  <TH className="hidden md:table-cell">Validade</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {clientPkgs.data.map((cp) => {
                  const expired = cp.expiresAt && new Date(cp.expiresAt) < new Date();
                  return (
                    <TR key={cp.id}>
                      <TD className="font-medium">{cp.client.name}</TD>
                      <TD>{cp.package.name}</TD>
                      <TD className="text-xs">
                        {cp.items.map((i) => (
                          <div key={i.id}>
                            {i.service?.name ?? i.product?.name}: <b>{i.totalQty - i.usedQty}</b>/{i.totalQty}
                          </div>
                        ))}
                      </TD>
                      <TD className="hidden whitespace-nowrap md:table-cell">
                        {fmtDate(cp.purchasedAt)} · {money(cp.pricePaid)}
                      </TD>
                      <TD className="hidden whitespace-nowrap md:table-cell">{cp.expiresAt ? fmtDate(cp.expiresAt) : '-'}</TD>
                      <TD>{!cp.isActive ? <Badge variant="secondary">Encerrado</Badge> : expired ? <Badge variant="destructive">Vencido</Badge> : <Badge variant="success">Ativo</Badge>}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent size="lg" title={draft?.id ? 'Editar pacote' : 'Novo pacote'}>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.name.trim().length < 2) return toast.error('Informe o nome do pacote');
                if (!draft.items.some((i) => i.ref)) return toast.error('Adicione pelo menos um item');
                save.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nome" required className="sm:col-span-3">
                  <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: 4 cortes no mês" />
                </Field>
                <Field label="Preço" required hint={fullPrice > 0 ? `Valor avulso: ${money(fullPrice)}` : undefined}>
                  <MoneyInput value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />
                </Field>
                <Field label="Validade (dias)" hint="Em branco = sem validade">
                  <Input type="number" min={1} value={draft.validityDays} onChange={(e) => setDraft({ ...draft, validityDays: e.target.value })} />
                </Field>
                <div className="space-y-2 pt-6 text-sm">
                  <label className="flex items-center justify-between gap-2">
                    Ativo <Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    Vender online <Switch checked={draft.sellOnline} onCheckedChange={(v) => setDraft({ ...draft, sellOnline: v })} />
                  </label>
                </div>
              </div>
              <Field label="Descrição">
                <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div className="space-y-2">
                <div className="text-sm font-medium">Itens do pacote</div>
                {draft.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={it.ref}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...it, ref: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                      className="flex-1"
                    >
                      <option value="">Selecione serviço ou produto...</option>
                      <optgroup label="Serviços">
                        {services.data?.map((s) => (
                          <option key={s.id} value={`s:${s.id}`}>
                            {s.name} ({money(s.price)})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Produtos">
                        {products.data?.map((s) => (
                          <option key={s.id} value={`p:${s.id}`}>
                            {s.name} ({money(s.salePrice)})
                          </option>
                        ))}
                      </optgroup>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...it, quantity: Math.max(1, Number(e.target.value) || 1) };
                        setDraft({ ...draft, items });
                      }}
                      className="w-20"
                    />
                    <Button type="button" size="icon" variant="ghost" disabled={draft.items.length === 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>
                      <X />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, items: [...draft.items, { ref: '', quantity: 1 }] })}>
                  <Plus /> Adicionar item
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={save.isPending}>
                  Salvar pacote
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Desativar pacote?" description={`"${removing?.name}" deixará de ser vendido. Pacotes já comprados continuam válidos.`} confirmText="Desativar" variant="destructive" loading={remove.isPending} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}
