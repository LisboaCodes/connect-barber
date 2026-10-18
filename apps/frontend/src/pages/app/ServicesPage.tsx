import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Clock, Globe, MoreVertical, Pencil, Plus, Power, Scissors, Search, Tags, Trash2 } from 'lucide-react';
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
  Skeleton,
  Switch,
} from '@/components/ui';
import { CategoryManagerDialog } from '@/components/settings/CategoryManagerDialog';
import { ServiceFormDialog } from '@/components/settings/ServiceFormDialog';
import { errorMessage } from '@/lib/api/client';
import { servicesApi, type Service } from '@/lib/api/services';
import { minutes, money } from '@/lib/utils/format';
import { useIsManager } from '@/store/auth.store';

export default function ServicesPage() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [defaultCat, setDefaultCat] = useState<string | undefined>();
  const [catsOpen, setCatsOpen] = useState(false);
  const [removing, setRemoving] = useState<Service | null>(null);

  const { data: services, isLoading } = useQuery({ queryKey: ['services', 'all'], queryFn: () => servicesApi.list(true) });
  const { data: categories = [] } = useQuery({ queryKey: ['services', 'categories'], queryFn: servicesApi.categories });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['services'] });

  const reorder = useMutation({
    mutationFn: servicesApi.reorder,
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ['services', 'all'] });
      const prev = qc.getQueryData<Service[]>(['services', 'all']);
      if (prev) {
        const byId = new Map(prev.map((s) => [s.id, s]));
        qc.setQueryData(['services', 'all'], ids.map((id, i) => ({ ...byId.get(id)!, displayOrder: i })).filter((s) => s.id));
      }
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(['services', 'all'], ctx.prev);
      toast.error(errorMessage(e));
    },
    onSettled: invalidate,
  });

  const toggle = useMutation({
    mutationFn: (s: Service) => servicesApi.update(s.id, { isActive: !s.isActive }),
    onSuccess: (s) => {
      toast.success(s.isActive ? 'Serviço ativado' : 'Serviço desativado');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (s: Service) => servicesApi.remove(s.id),
    onSuccess: () => {
      toast.success('Serviço excluído');
      setRemoving(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const ordered = useMemo(() => [...(services ?? [])].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)), [services]);
  const visible = ordered.filter((s) => (showInactive || s.isActive) && (!search || s.name.toLowerCase().includes(search.toLowerCase())));

  const groups = useMemo(() => {
    const g = categories.map((c) => ({ id: c.id, name: c.name, items: visible.filter((s) => s.categoryId === c.id) }));
    const none = visible.filter((s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId));
    if (none.length) g.push({ id: '', name: 'Sem categoria', items: none });
    return g.filter((x) => x.items.length || (!search && x.id));
  }, [categories, visible, search]);

  /** Troca o serviço com o vizinho do mesmo grupo e envia a ordem completa */
  const move = (s: Service, group: Service[], dir: -1 | 1) => {
    const idx = group.findIndex((x) => x.id === s.id);
    const other = group[idx + dir];
    if (!other) return;
    const ids = ordered.map((x) => x.id);
    const a = ids.indexOf(s.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    reorder.mutate(ids);
  };

  const openCreate = (categoryId?: string) => {
    setEditing(null);
    setDefaultCat(categoryId);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="Catálogo de serviços, preços, duração e comissões"
        actions={
          isManager && (
            <>
              <Button variant="outline" onClick={() => setCatsOpen(true)}>
                <Tags /> Categorias
              </Button>
              <Button onClick={() => openCreate()}>
                <Plus /> Novo serviço
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input prefix={<Search className="h-4 w-4" />} placeholder="Buscar serviço" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Label className="flex items-center gap-2 font-normal">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Mostrar inativos
        </Label>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !ordered.length ? (
        <EmptyState icon={Scissors} title="Nenhum serviço cadastrado" description="Cadastre cortes, barba, combos e tratamentos." action={isManager && <Button onClick={() => openCreate()}><Plus /> Novo serviço</Button>} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.id || 'none'}>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="font-semibold">
                  {g.name} <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span>
                </h2>
                {isManager && (
                  <Button variant="ghost" size="sm" onClick={() => openCreate(g.id || undefined)}>
                    <Plus /> Adicionar
                  </Button>
                )}
              </div>
              {!g.items.length ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum serviço nesta categoria.</p>
              ) : (
                <ul className="divide-y">
                  {g.items.map((s, i) => (
                    <li key={s.id} className={`flex items-center gap-3 px-4 py-3 ${!s.isActive ? 'opacity-60' : ''}`}>
                      <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? '#f59e0b' }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          {!s.isActive && <Badge variant="secondary">Inativo</Badge>}
                          {s.allowOnlineBooking && s.isActive && (
                            <Badge variant="success" className="gap-1">
                              <Globe className="h-3 w-3" /> Online
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {minutes(s.durationMinutes)}
                          </span>
                          {s.commissionPct !== null && s.commissionPct !== undefined && <span>Comissão {Number(s.commissionPct)}%</span>}
                          {s.returnDays && <span>Retorno em {s.returnDays} dias</span>}
                          <span>{s.professionals.length ? `${s.professionals.length} profissional(is)` : 'Todos os profissionais'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{money(s.price)}</div>
                        {Number(s.costPrice) > 0 && <div className="text-xs text-muted-foreground">custo {money(s.costPrice)}</div>}
                      </div>
                      {isManager && (
                        <div className="flex items-center">
                          <div className="hidden flex-col sm:flex">
                            <button className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={i === 0 || reorder.isPending} onClick={() => move(s, g.items, -1)} aria-label="Subir">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={i === g.items.length - 1 || reorder.isPending} onClick={() => move(s, g.items, 1)} aria-label="Descer">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Ações">
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(s);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="sm:hidden" disabled={i === 0} onClick={() => move(s, g.items, -1)}>
                                <ArrowUp /> Mover para cima
                              </DropdownMenuItem>
                              <DropdownMenuItem className="sm:hidden" disabled={i === g.items.length - 1} onClick={() => move(s, g.items, 1)}>
                                <ArrowDown /> Mover para baixo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggle.mutate(s)}>
                                <Power /> {s.isActive ? 'Desativar' : 'Ativar'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onClick={() => setRemoving(s)}>
                                <Trash2 /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} service={editing} categories={categories} defaultCategoryId={defaultCat} nextOrder={ordered.length} />
      <CategoryManagerDialog
        open={catsOpen}
        onOpenChange={setCatsOpen}
        title="Categorias de serviços"
        items={categories.map((c) => ({ id: c.id, name: c.name, count: c._count?.services }))}
        onCreate={async (name) => {
          await servicesApi.createCategory({ name, displayOrder: categories.length });
          await invalidate();
        }}
        onRename={async (id, name) => {
          await servicesApi.updateCategory(id, { name });
          await invalidate();
        }}
        onRemove={async (id) => {
          await servicesApi.removeCategory(id);
          await invalidate();
        }}
        onMove={async (ids) => {
          await Promise.all(ids.map((id, i) => servicesApi.updateCategory(id, { name: categories.find((c) => c.id === id)!.name, displayOrder: i })));
          await invalidate();
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Excluir "${removing?.name ?? ''}"?`}
        description="O serviço deixa de aparecer na agenda e no site. O histórico de atendimentos é mantido."
        confirmText="Excluir"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </div>
  );
}
