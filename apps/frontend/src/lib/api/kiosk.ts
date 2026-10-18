import axios from 'axios';
import { API_URL } from './client';

/** Cliente da API do totem: sem token de usuário, usa o header x-kiosk-token */
export function kioskClient(slug: string, token: string) {
  const http = axios.create({ baseURL: `${API_URL}/public/barbershops/${slug}/kiosk`, headers: { 'x-kiosk-token': token }, timeout: 30000 });
  return {
    config: () => http.get<KioskConfig>('/config').then((r) => r.data),
    identify: (phone: string) => http.post<KioskIdentify>('/identify', { phone }).then((r) => r.data),
    register: (payload: { name: string; phone: string; email?: string }) => http.post<KioskIdentify & { found?: boolean }>('/register', payload).then((r) => r.data),
    checkin: (appointmentId: string) => http.post<{ ok: boolean; already: boolean }>(`/checkin/${appointmentId}`).then((r) => r.data),
    walkIn: (payload: { clientId: string; serviceIds: string[]; professionalId?: string }) => http.post<{ appointment: { id: string; time: string; waitMinutes: number; professional: { id: string; name: string; avatarUrl: string | null; color: string } | null } }>('/walk-in', payload).then((r) => r.data),
    pay: (orderId: string, method: 'PIX' | 'POS' | 'COUNTER') => http.post<KioskPayResult>(`/orders/${orderId}/pay`, { method }).then((r) => r.data),
    paymentStatus: (intentId: string) => http.get<{ id: string; status: string; orderClosed: boolean }>(`/payments/${intentId}`).then((r) => r.data),
  };
}

export interface KioskConfig {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  payments: { pix: boolean; pos: boolean; counter: boolean };
  services: { id: string; name: string; price: number; durationMinutes: number; categoryId: string | null; imageUrl: string | null }[];
  professionals: { id: string; name: string; avatarUrl: string | null; color: string }[];
}

export interface KioskClient {
  id: string;
  name: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  visitsCount: number;
}

export interface KioskAppointment {
  id: string;
  startAt: string;
  time: string;
  status: string;
  checkedInAt: string | null;
  professional: { id: string; name: string; avatarUrl: string | null; color: string };
  services: string[];
  totalPrice: number;
  prepaidAmount: number;
  orderId: string | null;
}

export interface KioskOrder {
  id: string;
  number: number;
  total: number;
  paidTotal: number;
  remaining: number;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number; type: string }[];
}

export interface KioskIdentify {
  found: boolean;
  phone?: string;
  client?: KioskClient;
  today?: string;
  appointments?: KioskAppointment[];
  openOrders?: KioskOrder[];
  nextAppointment?: { id: string; startAt: string } | null;
}

export interface KioskPayResult {
  paid: boolean;
  counter?: boolean;
  remaining: number;
  intent?: { id: string; kind: 'PIX' | 'POS'; qrCode: string | null; copyPaste: string | null; expiresAt: string | null; status: string };
}
