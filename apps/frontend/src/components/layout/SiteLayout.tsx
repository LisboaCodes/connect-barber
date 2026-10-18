import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/auth.store';

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/funcionalidades', label: 'Funcionalidades' },
  { to: '/precos', label: 'Preços' },
];

/** Layout do site institucional (landing) */
export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const token = useAuthStore((s) => s.accessToken);
  const current = useAuthStore((s) => s.current);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">💈</span>
            Connect Barber
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn('rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground', isActive && 'text-foreground')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {token ? (
              <Button asChild>
                <Link to={current ? '/app' : '/cliente'}>Acessar painel</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/cliente/login">Sou cliente</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/login">Acessar</Link>
                </Button>
                <Button asChild>
                  <Link to="/cadastro">Teste grátis 30 dias</Link>
                </Button>
              </>
            )}
          </div>
          <button className="ml-auto md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="border-t px-4 py-3 md:hidden">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button variant="outline" asChild>
                <Link to="/cliente/login">Sou cliente</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Acessar</Link>
              </Button>
              <Button asChild>
                <Link to="/cadastro">Teste grátis 30 dias</Link>
              </Button>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-gray-950 text-gray-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-lg font-bold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">💈</span>
              Connect Barber
            </div>
            <p className="mt-3 max-w-md text-sm text-gray-400">Sistema de gestão on-line para barbearias: agenda, comandas, caixa, estoque, comissões, fidelidade e site com agendamento. Uma nova experiência para uma antiga tradição.</p>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold text-white">Produto</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/funcionalidades" className="hover:text-white">Funcionalidades</Link></li>
              <li><Link to="/precos" className="hover:text-white">Preços</Link></li>
              <li><Link to="/cadastro" className="hover:text-white">Criar conta</Link></li>
              <li><Link to="/cliente/login" className="hover:text-white">Área do cliente</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold text-white">Contato</div>
            <ul className="space-y-2 text-sm">
              <li>contato@creativenext.dev</li>
              <li>Suporte via WhatsApp</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} Connect Barber · Creative Labs. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
