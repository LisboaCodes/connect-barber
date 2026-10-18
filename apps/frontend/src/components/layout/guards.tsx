import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MemberRole, useAuthStore } from '@/store/auth.store';

/** Exige login */
export function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/** Exige barbearia ativa no token (membro da equipe) */
export function RequireTenant() {
  const current = useAuthStore((s) => s.current);
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  if (!current) return <Navigate to="/cliente" replace />;
  return <Outlet />;
}

/** Exige papel específico */
export function RequireRole({ roles }: { roles: MemberRole[] }) {
  const current = useAuthStore((s) => s.current);
  const user = useAuthStore((s) => s.user);
  if (user?.isSuperAdmin) return <Outlet />;
  if (!current || !roles.includes(current.role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RequireSuperAdmin() {
  const user = useAuthStore((s) => s.user);
  if (!user?.isSuperAdmin) return <Navigate to="/app" replace />;
  return <Outlet />;
}

/** Redireciona usuário logado para o painel */
export function RedirectIfAuthenticated() {
  const token = useAuthStore((s) => s.accessToken);
  const current = useAuthStore((s) => s.current);
  if (token) return <Navigate to={current ? '/app' : '/cliente'} replace />;
  return <Outlet />;
}
