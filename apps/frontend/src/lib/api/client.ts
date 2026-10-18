import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  const { refreshToken, setSession, clear } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    setSession(data);
    return data.accessToken as string;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<any>) => {
    const original: any = error.config;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login') && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      refreshing = refreshing ?? refreshToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Mensagem amigável de erro da API */
export function errorMessage(e: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const err = e as AxiosError<any>;
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  if (err?.code === 'ERR_NETWORK') return 'Sem conexão com o servidor';
  return err?.message || fallback;
}

export default api;
