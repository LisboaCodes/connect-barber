import api from './client';
import { Session, useAuthStore } from '@/store/auth.store';

export const authApi = {
  async login(email: string, password: string, tenantId?: string) {
    const { data } = await api.post<Session>('/auth/login', { email, password, tenantId });
    useAuthStore.getState().setSession(data);
    return data;
  },
  async register(payload: { tenantName: string; name: string; email: string; phone: string; password: string; ownerIsProfessional?: boolean; city?: string; state?: string }) {
    const { data } = await api.post<Session>('/auth/register', payload);
    useAuthStore.getState().setSession(data);
    return data;
  },
  async registerClient(payload: { name: string; email: string; phone: string; password: string }) {
    const { data } = await api.post<Session>('/auth/register-client', payload);
    useAuthStore.getState().setSession(data);
    return data;
  },
  async switchTenant(tenantId: string) {
    const { data } = await api.post<Session>(`/auth/switch/${tenantId}`);
    useAuthStore.getState().setSession(data);
    return data;
  },
  async me() {
    const { data } = await api.get('/auth/me');
    return data as { user: Session['user']; memberships: Session['memberships']; current: Session['current']; isClient: boolean };
  },
  async logout() {
    const { refreshToken, clear } = useAuthStore.getState();
    try {
      await api.post('/auth/logout', { refreshToken });
    } finally {
      clear();
    }
  },
  forgot: (email: string) => api.post('/auth/forgot-password', { email }),
  reset: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
  updateProfile: async (payload: { name?: string; phone?: string; avatarUrl?: string }) => {
    const { data } = await api.patch('/auth/me', payload);
    useAuthStore.getState().updateUser(data);
    return data;
  },
};
