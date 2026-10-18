import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  Gift,
  Globe,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Percent,
  Scissors,
  Settings,
  ShieldCheck,
  Star,
  User,
  Users,
  Wallet,
  X,
  Boxes,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MemberRole, useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api/auth';
import { Avatar, Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, TooltipProvider } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/utils/format';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: MemberRole[];
  end?: boolean;
}

const MANAGERS: MemberRole[] = ['OWNER', 'ADMIN'];
const STAFF: MemberRole[] = ['OWNER', 'ADMIN', 'RECEPTION'];

const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
      { to: '/app/agenda', label: 'Agenda', icon: Calendar },
      { to: '/app/comandas', label: 'Comandas', icon: ClipboardList },
      { to: '/app/caixa', label: 'Caixa', icon: Wallet, roles: STAFF },
      { to: '/app/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/app/profissionais', label: 'Profissionais', icon: Scissors },
      { to: '/app/servicos', label: 'Serviços', icon: ListChecks },
      { to: '/app/produtos', label: 'Produtos e estoque', icon: Boxes },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/app/financeiro', label: 'Financeiro', icon: CreditCard, roles: MANAGERS },
      { to: '/app/comissoes', label: 'Comissões', icon: Percent },
      { to: '/app/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    title: 'Clientes',
    items: [
      { to: '/app/fidelidade', label: 'Fidelidade e pacotes', icon: Gift, roles: STAFF },
      { to: '/app/campanhas', label: 'Notícias e promoções', icon: Megaphone, roles: MANAGERS },
      { to: '/app/lista-espera', label: 'Lista de espera', icon: Clock },
      { to: '/app/pesquisas', label: 'Satisfação', icon: Star },
      { to: '/app/mensagens', label: 'Mensagens enviadas', icon: Bell, roles: STAFF },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/app/configuracoes', label: 'Barbearia e equipe', icon: Settings, roles: MANAGERS },
      { to: '/app/site', label: 'Site e agendamento online', icon: Globe, roles: MANAGERS },
      { to: '/app/plano', label: 'Plano e cobrança', icon: ShieldCheck, roles: MANAGERS },
    ],
  },
];

export default function AppShell() {
  const { user, current, memberships, clear } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const role = current?.role;

  useEffect(() => setOpen(false), [location.pathname]);

  const visible = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (role && i.roles.includes(role)) || user?.isSuperAdmin) })).filter((g) => g.items.length);

  const logout = async () => {
    await authApi.logout();
    clear();
    navigate('/login');
  };

  const planBadge = current?.tenant.planStatus;

  const Sidebar = (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link to="/app" className="flex items-center">
          <img src="/logo-dark.png" alt="Connect Barber" className="h-12 w-auto" />
        </Link>
        <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {visible.map((g, gi) => (
          <div key={gi} className="mb-4">
            {g.title && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</div>}
            {g.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white', isActive && 'bg-primary/15 text-primary font-medium')}
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 text-xs text-white/50">
        {planBadge === 'TRIAL' && (
          <Link to="/app/plano" className="mb-2 block rounded-md bg-primary/15 px-3 py-2 text-primary">
            Teste grátis ativo · <span className="underline">ver planos</span>
          </Link>
        )}
        <div className="px-3">v1.0</div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-muted/40">
        {/* sidebar desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="fixed h-screen w-64">{Sidebar}</div>
        </aside>
        {/* sidebar mobile */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72">{Sidebar}</div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            {/* seletor de barbearia */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent">
                  <Avatar src={current?.tenant.logoUrl} name={current?.tenant.name} size="sm" color="#C9A227" />
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{current?.tenant.name}</div>
                    <div className="text-[11px] text-muted-foreground">{role ? ROLE_LABEL[role] : ''}</div>
                  </div>
                  {memberships.length > 1 && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </DropdownMenuTrigger>
              {memberships.length > 1 && (
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Minhas barbearias</DropdownMenuLabel>
                  {memberships.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => authApi.switchTenant(m.tenantId).then(() => navigate('/app'))}>
                      <Avatar src={m.tenant.logoUrl} name={m.tenant.name} size="sm" color="#C9A227" />
                      <span className="truncate">{m.tenant.name}</span>
                      {m.tenantId === current?.tenantId && <Badge variant="secondary" className="ml-auto">atual</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>
            <div className="ml-auto flex items-center gap-2">
              {current && (
                <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
                  <a href={`/b/${current.tenant.slug}`} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4" /> Ver site
                  </a>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full">
                    <Avatar src={user?.avatarUrl} name={user?.name} size="md" color="#111827" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium text-foreground">{user?.name}</div>
                    <div className="truncate text-xs">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/app/perfil')}>
                    <User /> Meu perfil
                  </DropdownMenuItem>
                  {user?.isSuperAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <ShieldCheck /> Administração
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/cliente')}>
                    <Calendar /> Meus agendamentos (cliente)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} destructive>
                    <LogOut /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { Package };
