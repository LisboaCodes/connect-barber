import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, Search, UserPlus, X } from 'lucide-react';
import { Avatar, Button, Input, Spinner } from '@/components/ui';
import { catalogApi } from '@/lib/api/appointments';
import { fmtPhone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface ClientPick {
  id?: string;
  name: string;
  phone?: string | null;
  isNew?: boolean;
  loyaltyPoints?: number;
}

export function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Converte a escolha em campos aceitos pela API (clientId | clientName + clientPhone) */
export function clientPayload(c: ClientPick | null): { clientId?: string; clientName?: string; clientPhone?: string } {
  if (!c) return {};
  if (c.id) return { clientId: c.id };
  return { clientName: c.name.trim(), clientPhone: c.phone?.replace(/\D/g, '') || undefined };
}

export function ClientSearch({
  value,
  onChange,
  allowNew = true,
  placeholder = 'Buscar cliente por nome ou telefone...',
  className,
  autoFocus,
}: {
  value: ClientPick | null;
  onChange: (c: ClientPick | null) => void;
  allowNew?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const debounced = useDebounced(term.trim(), 300);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['clients-search', debounced],
    queryFn: () => catalogApi.searchClients(debounced, 8),
    enabled: open && !value && !creating && debounced.length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // cliente selecionado
  if (value) {
    return (
      <div className={cn('flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2', className)}>
        <Avatar name={value.name} size="sm" color="#f59e0b" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {value.name} {value.isNew && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">novo</span>}
          </div>
          {value.phone && <div className="text-xs text-muted-foreground">{fmtPhone(value.phone)}</div>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} title="Trocar cliente">
          <X />
        </Button>
      </div>
    );
  }

  // cadastro rápido
  if (creating) {
    const digits = newPhone.replace(/\D/g, '');
    return (
      <div className={cn('space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-3', className)}>
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-amber-800">
          <span className="flex items-center gap-1">
            <UserPlus className="h-3.5 w-3.5" /> Novo cliente
          </span>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setCreating(false)}>
            voltar à busca
          </button>
        </div>
        <Input placeholder="Nome do cliente" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        <Input placeholder="WhatsApp (DDD + número)" inputMode="tel" prefix={<Phone className="h-3.5 w-3.5" />} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={newName.trim().length < 2 || (digits.length > 0 && digits.length < 10)}
            onClick={() => {
              onChange({ name: newName.trim(), phone: digits || null, isNew: true });
              setCreating(false);
            }}
          >
            Usar este cliente
          </Button>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Input
        prefix={<Search className="h-4 w-4" />}
        suffix={isFetching ? <Spinner className="h-4 w-4" /> : undefined}
        placeholder={placeholder}
        value={term}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
      />
      {open && (term.trim().length >= 2 || allowNew) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {term.trim().length < 2 && <div className="px-3 py-2 text-xs text-muted-foreground">Digite ao menos 2 letras para buscar</div>}
          {term.trim().length >= 2 && !isFetching && items.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</div>}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
              onClick={() => {
                onChange({ id: c.id, name: c.name, phone: c.phone, loyaltyPoints: c.loyaltyPoints });
                setTerm('');
                setOpen(false);
              }}
            >
              <Avatar src={c.avatarUrl} name={c.name} size="sm" color="#6b7280" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone ? fmtPhone(c.phone) : c.email || 'sem telefone'}</div>
              </div>
            </button>
          ))}
          {allowNew && (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50"
              onClick={() => {
                const t = term.trim();
                const isPhone = /^[\d\s()+-]+$/.test(t);
                setNewName(isPhone ? '' : t);
                setNewPhone(isPhone ? t : '');
                setCreating(true);
                setOpen(false);
              }}
            >
              <UserPlus className="h-4 w-4" /> Cadastrar novo cliente{term.trim() ? ` "${term.trim()}"` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ClientSearch;
