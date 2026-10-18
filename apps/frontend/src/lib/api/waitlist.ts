import api from './client';

export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'BOOKED' | 'CANCELLED';

export interface WaitlistEntry {
  id: string;
  clientId: string;
  professionalId: string | null;
  serviceId: string | null;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: WaitlistStatus;
  notifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  client: { id: string; name: string; phone: string | null; email: string | null };
  professional: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
}

export interface WaitlistPayload {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  date: string;
  professionalId?: string;
  serviceId?: string;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
}

export const waitlistApi = {
  list: (params: { date?: string; from?: string; status?: string }) => api.get<WaitlistEntry[]>('/waitlist', { params }).then((r) => r.data),
  add: (payload: WaitlistPayload) => api.post<WaitlistEntry>('/waitlist', payload).then((r) => r.data),
  notify: (id: string, text?: string) => api.post<WaitlistEntry>(`/waitlist/${id}/notify`, text ? { text } : {}).then((r) => r.data),
  setStatus: (id: string, status: WaitlistStatus) => api.patch<WaitlistEntry>(`/waitlist/${id}/status`, { status }).then((r) => r.data),
};
