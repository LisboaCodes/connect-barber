import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Scissors, ShoppingBag, Sparkles, Ticket } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input, MoneyInput, Select, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { catalogApi, servicePriceFor } from '@/lib/api/appointments';
import { ordersApi, type AddItemPayload, type Order, type OrderItem, type OrderItemType } from '@/lib/api/orders';
import { errorMessage } from '@/lib/api/client';
import { fmtDate, money } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

type Tab = OrderItemType | 'SESSION';

function useProfessionals(enabled: boolean) {
  const q = useQuery({ queryKey: ['professionals'], queryFn: catalogApi.professionals, enabled, staleTime: 120_000 });
  return (q.data ?? []).filter((p) => p.isActive !== false);
}

export function AddItemDialog({ order, open, onOpenChange, onDone }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void; onDone: (o: Order) => void }) {
  const isPro = useAuthStore((s) => s.current?.role === 'PROFESSIONAL');
  const ownProId = useAuthStore((s) => s.current?.professionalId ?? '');
  const consumption = order.kind === 'PROFESSIONAL_CONSUMPTION';
  const [tab, setTab] = useState<Tab>(consumption ? 'PRODUCT' : 'SERVICE');
  const [refId, setRefId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab(consumption ? 'PRODUCT' : 'SERVICE');
    setProfessionalId(isPro ? ownProId : order.professionalId ?? '');
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setRefId('');
    setQuantity(1);
    setUnitPrice('');
    setDiscount('');
    setDescription('');
  };

  const pros = useProfessionals(open);
  const servicesQ = useQuery({ queryKey: ['services'], queryFn: catalogApi.services, enabled: open && tab === 'SERVICE', staleTime: 120_000 });
  const productsQ = useQuery({ queryKey: ['products-for-sale'], queryFn: () => ordersApi.products(), enabled: open && tab === 'PRODUCT', staleTime: 60_000 });
  const packagesQ = useQuery({ queryKey: ['packages'], queryFn: ordersApi.packages, enabled: open && tab === 'PACKAGE', staleTime: 120_000 });
  const sessionsQ = useQuery({ queryKey: ['client-packages', order.clientId], queryFn: () => ordersApi.clientPackages(order.clientId!), enabled: open && !!order.clientId, staleTime: 30_000 });

  const sessions = useMemo(
    () =>
      (sessionsQ.data ?? [])
        .filter((cp) => cp.isActive && (!cp.expiresAt || new Date(cp.expiresAt) > new Date()))
        .flatMap((cp) => cp.items.filter((i) => i.usedQty < i.totalQty).map((i) => ({ ...i, packageName: cp.package.name, expiresAt: cp.expiresAt }))),
    [sessionsQ.data],
  );

  // preço padrão
  const defaultPrice = (() => {
    if (tab === 'SERVICE') {
      const s = servicesQ.data?.find((x) => x.id === refId);
      return s ? servicePriceFor(s, professionalId).price : 0;
    }
    if (tab === 'PRODUCT') return Number(productsQ.data?.items.find((x) => x.id === refId)?.salePrice ?? 0);
    if (tab === 'PACKAGE') return Number(packagesQ.data?.find((x) => x.id === refId)?.price ?? 0);
    return 0;
  })();
  const effPrice = tab === 'SESSION' ? 0 : unitPrice === '' ? defaultPrice : unitPrice;
  const lineTotal = Math.max(0, effPrice * quantity - (Number(discount) || 0));

  const add = useMutation({
    mutationFn: () => {
      const base: Partial<AddItemPayload> = {
        professionalId: professionalId || undefined,
        quantity,
        discountAmount: discount === '' ? undefined : discount,
      };
      if (tab === 'SESSION') {
        const s = sessions.find((x) => x.id === refId)!;
        return ordersApi.addItem(order.id, {
          ...base,
          type: s.serviceId ? 'SERVICE' : 'PRODUCT',
          serviceId: s.serviceId ?? undefined,
          productId: s.productId ?? undefined,
          clientPackageItemId: s.id,
          discountAmount: undefined,
        });
      }
      const payload: AddItemPayload = { ...base, type: tab, unitPrice: unitPrice === '' ? (tab === 'CUSTOM' ? 0 : undefined) : unitPrice };
      if (tab === 'SERVICE') payload.serviceId = refId;
      if (tab === 'PRODUCT') payload.productId = refId;
      if (tab === 'PACKAGE') payload.packageId = refId;
      if (tab === 'CUSTOM') payload.description = description.trim();
      return ordersApi.addItem(order.id, payload);
    },
    onSuccess: (o) => {
      toast.success('Item adicionado');
      onDone(o);
      reset();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const valid = tab === 'CUSTOM' ? description.trim().length > 1 : !!refId;
  const products = (productsQ.data?.items ?? []).filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Adicionar item">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Tab);
            reset();
          }}
        >
          <TabsList className="w-full">
            {!consumption && (
              <TabsTrigger value="SERVICE" className="flex-1 gap-1">
                <Scissors className="h-3.5 w-3.5" /> Serviço
              </TabsTrigger>
            )}
            <TabsTrigger value="PRODUCT" className="flex-1 gap-1">
              <ShoppingBag className="h-3.5 w-3.5" /> Produto
            </TabsTrigger>
            {!consumption && (
              <TabsTrigger value="PACKAGE" className="flex-1 gap-1">
                <Package className="h-3.5 w-3.5" /> Pacote
              </TabsTrigger>
            )}
            {!consumption && sessions.length > 0 && (
              <TabsTrigger value="SESSION" className="flex-1 gap-1">
                <Ticket className="h-3.5 w-3.5" /> Sessão
              </TabsTrigger>
            )}
            <TabsTrigger value="CUSTOM" className="flex-1 gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Avulso
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {tab === 'SERVICE' && (
            <Field label="Serviço" required>
              <Select value={refId} onChange={(e) => setRefId(e.target.value)}>
                <option value="">{servicesQ.isLoading ? 'Carregando...' : 'Selecione o serviço'}</option>
                {(servicesQ.data ?? [])
                  .filter((s) => s.isActive !== false)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {money(servicePriceFor(s, professionalId).price)}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          {tab === 'PRODUCT' && (
            <>
              <Input placeholder="Filtrar produtos" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              <Field label="Produto" required>
                <Select value={refId} onChange={(e) => setRefId(e.target.value)}>
                  <option value="">{productsQ.isLoading ? 'Carregando...' : 'Selecione o produto'}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.salePrice)} (estoque: {Number(p.stock)})
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {tab === 'PACKAGE' && (
            <>
              {!order.clientId && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Vincule um cliente à comanda para vender pacotes.</p>}
              <Field label="Pacote" required>
                <Select value={refId} onChange={(e) => setRefId(e.target.value)}>
                  <option value="">{packagesQ.isLoading ? 'Carregando...' : 'Selecione o pacote'}</option>
                  {(packagesQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.price)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {tab === 'SESSION' && (
            <Field label="Sessão do pacote do cliente" required hint="Item sem custo; a sessão é debitada ao fechar a comanda">
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {sessions.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-amber-50">
                    <input type="radio" name="session" checked={refId === s.id} onChange={() => setRefId(s.id)} />
                    <div className="flex-1">
                      <div className="font-medium">{s.service?.name ?? s.product?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.packageName} · restam {s.totalQty - s.usedQty} de {s.totalQty}
                        {s.expiresAt ? ` · vence ${fmtDate(s.expiresAt)}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>
          )}
          {tab === 'CUSTOM' && (
            <Field label="Descrição" required>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Ex.: Taxa de deslocamento" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={tab === 'PRODUCT' ? 'Vendedor' : 'Profissional'} className="col-span-2">
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={isPro}>
                <option value="">Nenhum</option>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qtd.">
              <Input type="number" min={tab === 'PRODUCT' ? 0.001 : 1} step={tab === 'PRODUCT' ? 'any' : 1} value={quantity} onChange={(e) => setQuantity(Math.max(0.001, Number(e.target.value) || 1))} />
            </Field>
            {tab !== 'SESSION' && (
              <Field label="Desconto">
                <MoneyInput value={discount} onChange={setDiscount} placeholder="0,00" />
              </Field>
            )}
            {tab !== 'SESSION' && (
              <Field label="Preço unitário" className="col-span-2" hint={tab !== 'CUSTOM' && unitPrice === '' && refId ? `Tabela: ${money(defaultPrice)}` : undefined}>
                <MoneyInput value={unitPrice} onChange={setUnitPrice} placeholder={tab === 'CUSTOM' ? '0,00' : defaultPrice.toFixed(2).replace('.', ',')} />
              </Field>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total do item {order.client?.club && tab !== 'SESSION' && discount === '' ? '(desconto do clube aplicado ao salvar)' : ''}</span>
            <span className="font-semibold">{money(lineTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => add.mutate()} disabled={!valid || (tab === 'PACKAGE' && !order.clientId)} loading={add.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDialog({ order, item, onOpenChange, onDone }: { order: Order; item: OrderItem | null; onOpenChange: (o: boolean) => void; onDone: (o: Order) => void }) {
  const isPro = useAuthStore((s) => s.current?.role === 'PROFESSIONAL');
  const [professionalId, setProfessionalId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>(0);
  const [discount, setDiscount] = useState<number | ''>(0);
  const pros = useProfessionals(!!item);

  useEffect(() => {
    if (!item) return;
    setProfessionalId(item.professionalId ?? '');
    setQuantity(Number(item.quantity));
    setUnitPrice(Number(item.unitPrice));
    setDiscount(Number(item.discountAmount));
  }, [item]);

  const save = useMutation({
    mutationFn: () =>
      ordersApi.updateItem(order.id, item!.id, {
        professionalId: professionalId || null,
        quantity,
        unitPrice: item!.clientPackageItemId ? undefined : Number(unitPrice) || 0,
        discountAmount: Number(discount) || 0,
      }),
    onSuccess: (o) => {
      toast.success('Item atualizado');
      onDone(o);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Editar item" description={item?.description}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Profissional" className="col-span-2">
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={isPro}>
              <option value="">Nenhum</option>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantidade">
            <Input type="number" min={0.001} step="any" value={quantity} onChange={(e) => setQuantity(Math.max(0.001, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Desconto">
            <MoneyInput value={discount} onChange={setDiscount} />
          </Field>
          {!item?.clientPackageItemId && (
            <Field label="Preço unitário" className="col-span-2">
              <MoneyInput value={unitPrice} onChange={setUnitPrice} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
