import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MemberRole = 'OWNER' | 'ADMIN' | 'RECEPTION' | 'PROFESSIONAL';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export interface Membership {
  id: string;
  tenantId: string;
  role: MemberRole;
  professionalId: string | null;
  permissions: Record<string, boolean> | null;
  tenant: { id: string; name: string; slug: string; logoUrl: string | null; planStatus: string; onboardingStep: number };
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  memberships: Membership[];
  current: Membership | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  memberships: Membership[];
  current: Membership | null;
  setSession: (s: Session) => void;
  updateUser: (u: Partial<AuthUser>) => void;
  updateCurrentTenant: (t: Partial<Membership['tenant']>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      memberships: [],
      current: null,
      setSession: (s) => set({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user, memberships: s.memberships, current: s.current }),
      updateUser: (u) => set((st) => ({ user: st.user ? { ...st.user, ...u } : st.user })),
      updateCurrentTenant: (t) =>
        set((st) => ({
          current: st.current ? { ...st.current, tenant: { ...st.current.tenant, ...t } } : st.current,
          memberships: st.memberships.map((m) => (m.tenantId === st.current?.tenantId ? { ...m, tenant: { ...m.tenant, ...t } } : m)),
        })),
      clear: () => set({ accessToken: null, refreshToken: null, user: null, memberships: [], current: null }),
    }),
    { name: 'cb-auth' },
  ),
);

export const useRole = () => useAuthStore((s) => s.current?.role ?? null);
export const useIsManager = () => useAuthStore((s) => s.current?.role === 'OWNER' || s.current?.role === 'ADMIN');
export const useIsStaff = () => useAuthStore((s) => ['OWNER', 'ADMIN', 'RECEPTION'].includes(s.current?.role ?? ''));
export const useIsAuthenticated = () => useAuthStore((s) => !!s.accessToken);
