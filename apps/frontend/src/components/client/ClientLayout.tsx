import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, LayoutDashboard, LogOut, Scissors, Store, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';

const NAV = [
  { to: '/cliente', label: 'Agendamentos', icon: CalendarDays, end: true },
  { to: '/cliente/barbearias', label: 'Barbearias', icon: Store, end: false },
  { to: '/cliente/perfil', label: 'Perfil', icon: UserCircle, end: false },
];

export default function ClientLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPanel = useAuthStore((s) => s.memberships.length > 0);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* sessão local já foi limpa */
    }
    toast.success('Você saiu da sua conta');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link to="/cliente" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Connect Barber</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('rounded-md px-3 py-1.5 text-sm font-medium', isActive ? 'bg-accent text-amber-900' : 'text-gray-600 hover:bg-gray-100')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-gray-100 focus:outline-none">
                <Avatar src={user?.avatarUrl} name={user?.name} size="sm" color="#d97706" />
                <span className="max-w-[140px] truncate text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-semibold text-foreground">{user?.name}</div>
                  <div className="truncate font-normal">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {NAV.map((n) => (
                  <DropdownMenuItem key={n.to} onSelect={() => navigate(n.to)}>
                    <n.icon /> {n.label}
                  </DropdownMenuItem>
                ))}
                {hasPanel && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate('/app')}>
                      <LayoutDashboard /> Ir para o painel da barbearia
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={logout}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {hasPanel && (
        <div className="border-b bg-amber-50">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="text-amber-900">Você também gerencia uma barbearia.</span>
            <Link to="/app" className="font-semibold text-amber-800 hover:underline">
              Ir para o painel →
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>

      {/* Navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-white sm:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-amber-700' : 'text-gray-500')}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
