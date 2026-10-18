import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge, Button, Dialog, DialogContent, DialogFooter, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { clientsApi, type ClientInput } from '@/lib/api/clients';

/** Converte "20/05/1990" ou "1990-05-20" em "1990-05-20" */
function parseBirth(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? (Number(m[3]) > 30 ? `19${m[3]}` : `20${m[3]}`) : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

interface ParsedRow {
  line: number;
  item?: ClientInput;
  error?: string;
}

function parse(text: string): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map((l, i) => ({ raw: l.trim(), line: i + 1 }))
    .filter((r) => r.raw && !/^nome\s*[;,\t]/i.test(r.raw))
    .map(({ raw, line }) => {
      const sep = raw.includes(';') ? ';' : raw.includes('\t') ? '\t' : ',';
      const [name = '', phone = '', email = '', birth = ''] = raw.split(sep).map((x) => x.trim());
      if (name.length < 2) return { line, error: 'Nome inválido' };
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return { line, error: 'E-mail inválido' };
      const birthDate = parseBirth(birth);
      if (birth && !birthDate) return { line, error: 'Data de nascimento inválida' };
      return { line, item: { name, phone: phone || undefined, email: email || undefined, birthDate: birthDate ?? undefined } };
    });
}

export function ImportClientsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const rows = useMemo(() => parse(text), [text]);
  const valid = rows.filter((r) => r.item).map((r) => r.item!);
  const invalid = rows.filter((r) => r.error);

  const mut = useMutation({
    mutationFn: () => clientsApi.import(valid),
    onSuccess: (r) => {
      toast.success(`${r.created} cliente(s) importado(s)${r.skipped ? ` · ${r.skipped} ignorado(s) (duplicados ou inválidos)` : ''}`);
      qc.invalidateQueries({ queryKey: ['clients'] });
      setText('');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Importar clientes" description="Cole uma linha por cliente no formato: nome;telefone;email;nascimento. Apenas o nome é obrigatório.">
        <Textarea
          rows={10}
          className="font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'João Silva;11999998888;joao@email.com;20/05/1990\nCarlos Souza;11988887777\nPedro Lima;;pedro@email.com'}
        />
        <p className="text-xs text-muted-foreground">Dica: copie as colunas direto de uma planilha (Excel/Google Sheets). Separadores aceitos: ponto e vírgula, tabulação ou vírgula. Telefones duplicados são ignorados.</p>
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="success">{valid.length} válido(s)</Badge>
            {invalid.length > 0 && <Badge variant="destructive">{invalid.length} com erro</Badge>}
          </div>
        )}
        {invalid.length > 0 && (
          <ul className="max-h-28 overflow-auto rounded-md border bg-red-50 p-2 text-xs text-red-700">
            {invalid.slice(0, 20).map((r) => (
              <li key={r.line}>
                Linha {r.line}: {r.error}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valid.length} loading={mut.isPending} onClick={() => mut.mutate()}>
            Importar {valid.length || ''} cliente(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportClientsDialog;
