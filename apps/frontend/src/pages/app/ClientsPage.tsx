import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Cake, MessageCircle, Plus, Search, Upload, Users, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
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
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { ImportClientsDialog } from '@/components/clients/ImportClientsDialog';
import { clientsApi, dateOnly, type ClientListParams } from '@/lib/api/clients';
import { fmtPhone, fmtRelative, money, num, whatsappLink } from '@/lib/utils/format';
import { useAuthStore } from '@/store/auth.store';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ClientsPage() {
  const [tab, setTab] = useState('clients');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro, histórico e relacionamento com seus clientes"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Importar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Novo cliente
            </Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clients">
            <Users className="mr-1.5 h-4 w-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="birthdays">
            <Cake className="mr-1.5 h-4 w-4" /> Aniversariantes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <ClientsList onCreate={() => setCreateOpen(true)} />
        </TabsContent>
        <TabsContent value="birthdays">
          <Birthdays />
        </TabsContent>
      </Tabs>
      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ClientsList({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [clubId, setClubId] = useState('');
  const [inactiveDays, setInactiveDays] = useState('');
  const [sort, setSort] = useState<NonNullable<ClientListParams['sort']>>('name');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  useEffect(() => setPage(1), [q, tag, clubId, inactiveDays, sort]);

  const params: ClientListParams = { search: q || undefined, tag: tag || undefined, clubId: clubId || undefined, inactiveDays: inactiveDays ? Number(inactiveDays) : undefined, sort, page, limit: 30 };
  const { data, isLoading, isFetching } = useQuery({ queryKey: ['clients', 'list', params], queryFn: () => clientsApi.list(params), placeholderData: keepPreviousData });
  const { data: tags } = useQuery({ queryKey: ['clients', 'tags'], queryFn: clientsApi.tags });
  const { data: clubs } = useQuery({ queryKey: ['clubs'], queryFn: clientsApi.clubs });

  const hasFilters = !!(search || tag || clubId || inactiveDays);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <Input prefix={<Search className="h-4 w-4" />} placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="lg:max-w-xs" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="sm:w-40">
            <option value="">Todas as etiquetas</option>
            {tags?.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag} ({t.count})
              </option>
            ))}
          </Select>
          <Select value={clubId} onChange={(e) => setClubId(e.target.value)} className="sm:w-40">
            <option value="">Todos os clubes</option>
            {clubs?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} className="sm:w-44">
            <option value="">Qualquer última visita</option>
            <option value="30">Sem visita há 30+ dias</option>
            <option value="45">Sem visita há 45+ dias</option>
            <option value="60">Sem visita há 60+ dias</option>
            <option value="90">Sem visita há 90+ dias</option>
            <option value="180">Sem visita há 180+ dias</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as any)} className="sm:w-40">
            <option value="name">Ordenar: nome</option>
            <option value="lastVisit">Última visita</option>
            <option value="totalSpent">Maior gasto</option>
            <option value="createdAt">Mais recentes</option>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSearch('');
                setTag('');
                setClubId('');
                setInactiveDays('');
              }}
            >
              <X /> Limpar
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          className="m-4"
          icon={Users}
          title={hasFilters ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={hasFilters ? 'Ajuste os filtros da busca.' : 'Cadastre seu primeiro cliente ou importe sua base atual.'}
          action={!hasFilters && <Button onClick={onCreate}><Plus /> Novo cliente</Button>}
        />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
          <Table>
            <THead>
              <TR>
                <TH>Cliente</TH>
                <TH className="hidden md:table-cell">Telefone</TH>
                <TH className="hidden lg:table-cell">Última visita</TH>
                <TH className="hidden sm:table-cell text-right">Visitas</TH>
                <TH className="text-right">Total gasto</TH>
                <TH className="hidden lg:table-cell text-right">Pontos</TH>
                <TH className="hidden xl:table-cell">Clube</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((c) => (
                <TR key={c.id} className="cursor-pointer" onClick={() => navigate(`/app/clientes/${c.id}`)}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar src={c.avatarUrl} name={c.name} color="#d97706" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <span className="truncate">{c.name}</span>
                          {c.blocked && <Badge variant="destructive">Bloqueado</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground md:hidden">{fmtPhone(c.phone)}</span>
                          {c.tags.slice(0, 3).map((t) => (
                            <span key={t} className="hidden rounded bg-muted px-1.5 text-[11px] text-muted-foreground md:inline">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    {c.phone ? (
                      <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 hover:text-emerald-600">
                        <MessageCircle className="h-4 w-4 text-emerald-600" /> {fmtPhone(c.phone)}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TD>
                  <TD className="hidden lg:table-cell text-muted-foreground">{c.lastVisitAt ? fmtRelative(c.lastVisitAt) : 'Nunca'}</TD>
                  <TD className="hidden sm:table-cell text-right">{c.visitsCount}</TD>
                  <TD className="text-right font-medium">{money(c.totalSpent)}</TD>
                  <TD className="hidden lg:table-cell text-right">{num(c.loyaltyPoints)}</TD>
                  <TD className="hidden xl:table-cell">{c.club ? <Badge variant="warning">{c.club.name}</Badge> : <span className="text-muted-foreground">-</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination className="border-t p-4" page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}
    </Card>
  );
}

function Birthdays() {
  const navigate = useNavigate();
  const tenantName = useAuthStore((s) => s.current?.tenant.name ?? 'nossa barbearia');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { data, isLoading } = useQuery({ queryKey: ['clients', 'birthdays', month], queryFn: () => clientsApi.birthdays(month) });
  const today = new Date();

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">{data ? `${data.length} aniversariante(s) em ${MONTHS[month - 1]}` : ' '}</div>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="sm:w-44">
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState className="m-4" icon={Cake} title="Nenhum aniversariante" description="Cadastre a data de nascimento dos clientes para acompanhar os aniversários." />
      ) : (
        <ul className="divide-y">
          {data.map((c) => {
            const [y, m, d] = dateOnly(c.birthDate).split('-').map(Number);
            const isToday = m === today.getMonth() + 1 && d === today.getDate();
            const age = today.getFullYear() - y;
            const msg = `Olá, ${c.name.split(' ')[0]}! 🎉 A equipe da ${tenantName} deseja um feliz aniversário! Que tal comemorar com um visual novo? Agende seu horário com a gente.`;
            return (
              <li key={c.id} className="flex items-center gap-3 p-4">
                <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${isToday ? 'border-amber-300 bg-amber-100 text-amber-800' : 'bg-muted/50'}`}>
                  <span className="text-lg font-bold leading-none">{String(d).padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase">{MONTHS[m - 1].slice(0, 3)}</span>
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/app/clientes/${c.id}`)}>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="truncate">{c.name}</span>
                    {isToday && <Badge variant="warning">Hoje!</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {y > 1900 ? `${age} anos · ` : ''}
                    {fmtPhone(c.phone)} · última visita {c.lastVisitAt ? fmtRelative(c.lastVisitAt) : 'nunca'}
                  </div>
                </button>
                {c.phone && (
                  <Button asChild variant="success" size="sm">
                    <a href={whatsappLink(c.phone, msg)} target="_blank" rel="noreferrer">
                      <MessageCircle /> <span className="hidden sm:inline">Parabenizar</span>
                    </a>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
