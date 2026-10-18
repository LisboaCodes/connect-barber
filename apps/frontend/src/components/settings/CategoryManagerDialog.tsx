import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, Dialog, DialogContent, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';

export interface CategoryItem {
  id: string;
  name: string;
  count?: number;
}

/** Gerenciador genérico de categorias (serviços e produtos) */
export function CategoryManagerDialog({
  open,
  onOpenChange,
  title = 'Categorias',
  items,
  onCreate,
  onRename,
  onRemove,
  onMove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  items: CategoryItem[];
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  /** Reordenação opcional: recebe a lista de ids na nova ordem */
  onMove?: (ids: string[]) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<CategoryItem | null>(null);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    if (await run(() => onCreate(name.trim()), 'Categoria criada')) setName('');
  };
  const rename = async () => {
    if (!editId || !editName.trim()) return;
    if (await run(() => onRename(editId, editName.trim()), 'Categoria renomeada')) setEditId(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    if (!onMove) return;
    const ids = items.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => onMove(ids));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title={title}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" maxLength={60} />
          <Button type="submit" disabled={!name.trim() || busy}>
            <Plus /> Adicionar
          </Button>
        </form>
        {!items.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 p-2">
                {editId === c.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          rename();
                        }
                        if (e.key === 'Escape') setEditId(null);
                      }}
                    />
                    <Button size="icon-sm" variant="ghost" onClick={rename} disabled={busy} aria-label="Salvar">
                      <Check className="text-emerald-600" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditId(null)} aria-label="Cancelar">
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                    {c.count !== undefined && <span className="text-xs text-muted-foreground">{c.count} item(ns)</span>}
                    {onMove && (
                      <>
                        <Button size="icon-sm" variant="ghost" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label="Subir">
                          <ArrowUp />
                        </Button>
                        <Button size="icon-sm" variant="ghost" disabled={i === items.length - 1 || busy} onClick={() => move(i, 1)} aria-label="Descer">
                          <ArrowDown />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(c.id);
                        setEditName(c.name);
                      }}
                      aria-label="Renomear"
                    >
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setRemoving(c)} aria-label="Excluir">
                      <Trash2 className="text-red-500" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <ConfirmDialog
          open={!!removing}
          onOpenChange={(o) => !o && setRemoving(null)}
          title={`Excluir "${removing?.name ?? ''}"?`}
          description="Os itens desta categoria ficarão sem categoria."
          confirmText="Excluir"
          variant="destructive"
          loading={busy}
          onConfirm={async () => {
            if (removing && (await run(() => onRemove(removing.id), 'Categoria excluída'))) setRemoving(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CategoryManagerDialog;
