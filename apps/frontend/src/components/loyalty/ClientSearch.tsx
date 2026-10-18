import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Input, Spinner } from '@/components/ui';
import { loyaltyApi, type ClientLite } from '@/lib/api/loyalty';
import { fmtPhone } from '@/lib/utils/format';

/** Busca de cliente com autocomplete (GET /clients?search=) */
export function ClientSearch({ value, onChange, placeholder = 'Buscar cliente por nome ou telefone' }: { value: ClientLite | null; onChange: (c: ClientLite | null) => void; placeholder?: string }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({ queryKey: ['clients', 'search', debounced], queryFn: () => loyaltyApi.searchClients(debounced), enabled: debounced.length >= 2 });

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border bg-muted/40 px-3 text-sm">
        <span className="truncate">
          <b>{value.name}</b> {value.phone && <span className="text-muted-foreground">· {fmtPhone(value.phone)}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" title="Trocar cliente">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        prefix={<Search className="h-4 w-4" />}
        suffix={isFetching ? <Spinner className="h-4 w-4" /> : undefined}
        value={term}
        placeholder={placeholder}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && debounced.length >= 2 && data && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {data.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum cliente encontrado</li>}
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c);
                  setTerm('');
                  setOpen(false);
                }}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.loyaltyPoints !== undefined ? `${c.loyaltyPoints} pts` : fmtPhone(c.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
