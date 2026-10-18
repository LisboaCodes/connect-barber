import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, Boxes, ClipboardList, MoreVertical, Package, Pencil, Plus, Power, Search, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  Switch,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { CategoryManagerDialog } from '@/components/settings/CategoryManagerDialog';
import { ProductFormDialog } from '@/components/settings/ProductFormDialog';
import { StockMovementDialog } from '@/components/settings/StockMovementDialog';
import { errorMessage } from '@/lib/api/client';
import { dateOnly } from '@/lib/api/clients';
import { MOVEMENT_LABEL, productsApi, type Product, type ProductCategory } from '@/lib/api/products';
import { fmtDate, fmtDateTime, fromISODate, money, num } from '@/lib/utils/format';
import { useIsManager, useIsStaff } from '@/store/auth.store';

const fmtDateOnly = (s: string | null) => (s ? fmtDate(fromISODate(dateOnly(s))) : '-');
const qty = (v: number) => num(Number(v), Number.isInteger(Number(v)) ? 0 : 2);

export default function ProductsPage() {
  const isManager = useIsManager();
  const isStaff = useIsStaff();
  const qc = useQueryClient();
  const [tab, setTab] = useState('products');
  const [catsOpen, setCatsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ['products', 'categories'], queryFn: productsApi.categories });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const openMove = (p: Product | null) => {
    setMoveProduct(p);
    setMoveOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Produtos e estoque"
        description="Cadastro de produtos, movimentações e inventário"
        actions={
          <>
            {isManager && (
              <Button variant="outline" onClick={() => setCatsOpen(true)}>
                <Tags /> Categorias
              </Button>
            )}
            {isStaff && (
              <Button variant="outline" onClick={() => openMove(null)}>
                <ArrowLeftRight /> Movimentar
              </Button>
            )}
            {isManager && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> Novo produto
              </Button>
            )}
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="products">
            <Package className="mr-1.5 h-4 w-4" /> Produtos
          </TabsTrigger>
          {isStaff && (
            <>
              <TabsTrigger value="movements">
                <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Movimentações
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Inventário
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="products">
          <ProductsTab
            categories={categories}
            isManager={isManager}
            isStaff={isStaff}
            onEdit={(p) => {
              setEditing(p);
              setFormOpen(true);
            }}
            onMove={openMove}
          />
        </TabsContent>
        {isStaff && (
          <>
            <TabsContent value="movements">
              <MovementsTab />
            </TabsContent>
            <TabsContent value="inventory">
              <InventoryTab />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} categories={categories} />
      <StockMovementDialog open={moveOpen} onOpenChange={setMoveOpen} product={moveProduct} />
      <CategoryManagerDialog
        open={catsOpen}
        onOpenChange={setCatsOpen}
        title="Categorias de produtos"
        items={categories.map((c) => ({ id: c.id, name: c.name, count: c._count?.products }))}
        onCreate={async (name) => {
          await productsApi.createCategory(name);
          await invalidate();
        }}
        onRename={async (id, name) => {
          await productsApi.updateCategory(id, name);
          await invalidate();
        }}
        onRemove={async (id) => {
          await productsApi.removeCategory(id);
          await invalidate();
        }}
      />
    </div>
  );
}

function StockAlerts() {
  const { data } = useQuery({ queryKey: ['products', 'inventory'], queryFn: productsApi.inventory });
  if (!data) return null;
  const low = data.items.filter((i) => i.lowStock);
  const expiring = data.items.filter((i) => i.expiringSoon || i.expired);
  if (!low.length && !expiring.length) return null;
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-2">
      {low.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{low.length} produto(s) com estoque baixo</div>
            <div className="text-amber-800">
              {low
                .slice(0, 5)
                .map((i) => `${i.name} (${qty(i.stock)})`)
                .join(', ')}
              {low.length > 5 ? '...' : ''}
            </div>
          </div>
        </div>
      )}
      {expiring.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{expiring.length} produto(s) vencido(s) ou vencendo em 30 dias</div>
            <div className="text-red-800">
              {expiring
                .slice(0, 5)
                .map((i) => `${i.name} (${fmtDateOnly(i.expiresAt)})`)
                .join(', ')}
              {expiring.length > 5 ? '...' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsTab({
  categories,
  isManager,
  isStaff,
  onEdit,
  onMove,
}: {
  categories: ProductCategory[];
  isManager: boolean;
  isStaff: boolean;
  onEdit: (p: Product) => void;
  onMove: (p: Product) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<Product | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [q, categoryId, lowStock, includeInactive]);

  const params = { search: q || undefined, categoryId: categoryId || undefined, lowStock, includeInactive, page, limit: 50 };
  const { data, isLoading, isFetching } = useQuery({ queryKey: ['products', 'list', params], queryFn: () => productsApi.list(params), placeholderData: keepPreviousData });

  const toggle = useMutation({
    mutationFn: (p: Product) => productsApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: (p) => {
      toast.success(p.isActive ? 'Produto ativado' : 'Produto desativado');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (p: Product) => productsApi.remove(p.id),
    onSuccess: () => {
      toast.success('Produto excluído');
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const now = new Date();
  const soon = new Date(Date.now() + 30 * 86400000);

  return (
    <>
      {isStaff && <StockAlerts />}
      <Card>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <Input prefix={<Search className="h-4 w-4" />} placeholder="Nome, marca, SKU ou código de barras" value={search} onChange={(e) => setSearch(e.target.value)} className="lg:max-w-xs" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="lg:w-48">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-4">
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={lowStock} onCheckedChange={setLowStock} /> Estoque baixo
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} /> Inativos
            </Label>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState className="m-4" icon={Package} title="Nenhum produto encontrado" description="Cadastre pomadas, shampoos, bebidas e itens de uso interno." />
        ) : (
          <div className={isFetching ? 'opacity-70' : ''}>
            <Table>
              <THead>
                <TR>
                  <TH>Produto</TH>
                  <TH className="hidden md:table-cell">Categoria</TH>
                  <TH className="text-right">Estoque</TH>
                  <TH className="hidden sm:table-cell text-right">Custo</TH>
                  <TH className="text-right">Venda</TH>
                  <TH className="hidden lg:table-cell">Validade</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {data.items.map((p) => {
                  const exp = p.expiresAt ? fromISODate(dateOnly(p.expiresAt)) : null;
                  return (
                    <TR key={p.id} className={!p.isActive ? 'opacity-60' : ''}>
                      <TD>
                        <div className="font-medium">{p.name}</div>
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {p.brand && <span>{p.brand}</span>}
                          {p.sku && <span>· {p.sku}</span>}
                          {!p.forSale && <Badge variant="outline">Uso interno</Badge>}
                          {!p.isActive && <Badge variant="secondary">Inativo</Badge>}
                        </div>
                      </TD>
                      <TD className="hidden md:table-cell text-muted-foreground">{p.category?.name ?? '-'}</TD>
                      <TD className="text-right">
                        <span className={p.lowStock ? 'font-semibold text-amber-700' : ''}>
                          {qty(p.stock)} {p.unit}
                        </span>
                        {p.lowStock && <div className="text-[11px] text-amber-700">mín. {qty(p.minStock)}</div>}
                      </TD>
                      <TD className="hidden sm:table-cell text-right text-muted-foreground">{money(p.costPrice)}</TD>
                      <TD className="text-right font-medium">{money(p.salePrice)}</TD>
                      <TD className="hidden lg:table-cell">
                        {exp ? <span className={exp < now ? 'font-medium text-red-600' : exp <= soon ? 'font-medium text-amber-700' : ''}>{fmtDate(exp)}</span> : <span className="text-muted-foreground">-</span>}
                      </TD>
                      <TD>
                        {isStaff && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Ações">
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onMove(p)}>
                                <ArrowLeftRight /> Movimentar estoque
                              </DropdownMenuItem>
                              {isManager && (
                                <>
                                  <DropdownMenuItem onClick={() => onEdit(p)}>
                                    <Pencil /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggle.mutate(p)}>
                                    <Power /> {p.isActive ? 'Desativar' : 'Ativar'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem destructive onClick={() => setRemoving(p)}>
                                    <Trash2 /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination className="border-t p-4" page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Excluir "${removing?.name ?? ''}"?`}
        description="O produto deixa de aparecer nas comandas. O histórico de vendas e movimentações é mantido."
        confirmText="Excluir"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </>
  );
}

function MovementsTab() {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [productId, type, from, to]);

  const { data: products } = useQuery({ queryKey: ['products', 'picker'], queryFn: () => productsApi.list({ limit: 200, includeInactive: true }) });
  const params = { productId: productId || undefined, type: type || undefined, from: from || undefined, to: to || undefined, page, limit: 50 };
  const { data, isLoading } = useQuery({ queryKey: ['products', 'movements', params], queryFn: () => productsApi.movements(params), placeholderData: keepPreviousData });

  return (
    <Card>
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Todos os produtos</option>
          {products?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState className="m-4" icon={ArrowLeftRight} title="Nenhuma movimentação no período" />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Data</TH>
                <TH>Produto</TH>
                <TH>Tipo</TH>
                <TH className="text-right">Qtd.</TH>
                <TH className="hidden sm:table-cell text-right">Saldo</TH>
                <TH className="hidden md:table-cell text-right">Custo un.</TH>
                <TH className="hidden lg:table-cell">Motivo</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((m) => {
                const q = Number(m.quantity);
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</TD>
                    <TD className="font-medium">{m.product?.name}</TD>
                    <TD>
                      <Badge variant={q >= 0 ? 'success' : m.type === 'LOSS' ? 'destructive' : 'secondary'}>{MOVEMENT_LABEL[m.type] ?? m.type}</Badge>
                    </TD>
                    <TD className={`text-right font-medium ${q >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {q > 0 ? '+' : ''}
                      {qty(q)}
                    </TD>
                    <TD className="hidden sm:table-cell text-right">
                      {qty(m.balanceAfter)} {m.product?.unit}
                    </TD>
                    <TD className="hidden md:table-cell text-right text-muted-foreground">{m.unitCost !== null ? money(m.unitCost) : '-'}</TD>
                    <TD className="hidden lg:table-cell text-muted-foreground">{m.reason ?? (m.orderId ? 'Venda em comanda' : '-')}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination className="border-t p-4" page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function InventoryTab() {
  const { data, isLoading } = useQuery({ queryKey: ['products', 'inventory'], queryFn: productsApi.inventory });
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  if (isLoading || !data)
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  const rows = onlyAlerts ? data.items.filter((i) => i.lowStock || i.expiringSoon || i.expired) : data.items;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Produtos ativos" value={num(data.totals.products)} icon={Boxes} />
        <StatCard label="Valor em estoque (custo)" value={money(data.totals.stockValue)} icon={Package} />
        <StatCard label="Valor de venda" value={money(data.totals.saleValue)} hint={`Lucro potencial ${money(data.totals.saleValue - data.totals.stockValue)}`} />
        <StatCard label="Alertas" value={`${data.totals.lowStock} / ${data.totals.expiringSoon}`} hint="estoque baixo / vencendo" icon={AlertTriangle} />
      </div>
      <Card>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Posição do estoque</h3>
          <Label className="flex items-center gap-2 font-normal">
            <Switch checked={onlyAlerts} onCheckedChange={setOnlyAlerts} /> Só com alerta
          </Label>
        </div>
        {!rows.length ? (
          <EmptyState className="m-4" icon={ClipboardList} title="Nada por aqui" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Produto</TH>
                <TH className="text-right">Saldo</TH>
                <TH className="hidden sm:table-cell text-right">Mínimo</TH>
                <TH className="hidden md:table-cell text-right">Valor (custo)</TH>
                <TH className="hidden md:table-cell text-right">Valor (venda)</TH>
                <TH className="hidden lg:table-cell">Validade</TH>
                <TH>Situação</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="text-right">
                    {qty(r.stock)} {r.unit}
                  </TD>
                  <TD className="hidden sm:table-cell text-right text-muted-foreground">{qty(r.minStock)}</TD>
                  <TD className="hidden md:table-cell text-right">{money(r.stockValue)}</TD>
                  <TD className="hidden md:table-cell text-right">{money(r.saleValue)}</TD>
                  <TD className="hidden lg:table-cell">{fmtDateOnly(r.expiresAt)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {r.expired ? <Badge variant="destructive">Vencido</Badge> : r.expiringSoon ? <Badge variant="warning">Vencendo</Badge> : null}
                      {r.lowStock && <Badge variant="warning">Repor</Badge>}
                      {!r.lowStock && !r.expiringSoon && !r.expired && <Badge variant="success">OK</Badge>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
