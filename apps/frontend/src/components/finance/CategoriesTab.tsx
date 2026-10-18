import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Dialog, DialogContent, DialogFooter, Field, Input, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { financeApi, type FinanceCategory, type FinanceType } from '@/lib/api/finance';

export function CategoriesTab({ categories }: { categories: FinanceCategory[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id?: string; name: string; type: FinanceType } | null>(null);
  const [removing, setRemoving] = useState<FinanceCategory | null>(null);

  const save = useMutation({
    mutationFn: (c: { id?: string; name: string; type: FinanceType }) => (c.id ? financeApi.updateCategory(c.id, { name: c.name, type: c.type }) : financeApi.createCategory({ name: c.name, type: c.type })),
    onSuccess: () => {
      toast.success('Categoria salva');
      qc.invalidateQueries({ queryKey: ['finance', 'categories'] });
      setEditing(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeApi.removeCategory(id),
    onSuccess: () => {
      toast.success('Categoria removida');
      qc.invalidateQueries({ queryKey: ['finance'] });
      setRemoving(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const col = (type: FinanceType, title: string) => (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setEditing({ name: '', type })}>
          <Plus /> Nova
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {categories
            .filter((c) => c.type === type)
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1">{c.name}</span>
                {c.isSystem && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" /> Padrão
                  </Badge>
                )}
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, type: c.type })} title="Editar">
                  <Pencil />
                </Button>
                {!c.isSystem && (
                  <Button size="icon-sm" variant="ghost" className="text-red-600" onClick={() => setRemoving(c)} title="Excluir">
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          {!categories.some((c) => c.type === type) && <li className="py-4 text-sm text-muted-foreground">Nenhuma categoria.</li>}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {col('EXPENSE', 'Categorias de despesa')}
      {col('INCOME', 'Categorias de receita')}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="sm" title={editing?.id ? 'Editar categoria' : 'Nova categoria'}>
          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.name.trim()) return toast.error('Informe o nome');
                save.mutate(editing);
              }}
            >
              <Field label="Nome" required>
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} />
              </Field>
              <Field label="Tipo">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as FinanceType })}>
                  <option value="EXPENSE">Despesa</option>
                  <option value="INCOME">Receita</option>
                </Select>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={save.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Excluir categoria?" description={`"${removing?.name}" será removida. Os lançamentos ficarão sem categoria.`} confirmText="Excluir" variant="destructive" loading={remove.isPending} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}
