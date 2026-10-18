import api from './client';

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type RecurrenceFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface AgendaProfessional {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  workSchedules: { id: string; weekday: number; startTime: string; endTime: string }[];
  scheduleOverrides: { id: string; date: string; type: 'EXTRA' | 'OFF'; startTime: string | null; endTime: string | null; reason: string | null }[];
}

export interface AgendaAppointment {
  id: string;
  clientId: string | null;
  professionalId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  source: string;
  isFitIn: boolean;
  notes: string | null;
  internalNotes: string | null;
  guestName: string | null;
  guestPhone: string | null;
  totalPrice: number;
  totalDuration: number;
  recurrenceId: string | null;
  orderId: string | null;
  cancelReason: string | null;
  client: { id: string; name: string; phone: string | null; email: string | null; avatarUrl: string | null; loyaltyPoints: number; visitsCount: number; noShowCount: number } | null;
  professional: { id: string; name: string; color: string; avatarUrl: string | null };
  services: { id: string; serviceId: string; price: number; durationMinutes: number; service: { id: string; name: string; color: string | null } }[];
  order: { id: string; number: number; status: string; total: number } | null;
}

export interface AgendaBlock {
  id: string;
  professionalId: string | null;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface AgendaData {
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  professionals: AgendaProfessional[];
  timezone: string;
  openingHours: Record<string, { start: string; end: string }[]> | null;
  slotIntervalMin: number;
}

export interface AvailabilityRow {
  professionalId: string;
  professionalName: string;
  color: string;
  working: { start: number; end: number }[];
  busy: { start: number; end: number }[];
  slots: string[];
  off: boolean;
}

export interface CreateAppointmentPayload {
  professionalId: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceIds: string[];
  date: string;
  time: string;
  fitIn?: boolean;
  durationMinutes?: number;
  notes?: string;
  internalNotes?: string;
  recurrence?: { frequency: RecurrenceFrequency; occurrences?: number; endsOn?: string };
}

export interface UpdateAppointmentPayload {
  professionalId?: string;
  clientId?: string | null;
  serviceIds?: string[];
  date?: string;
  time?: string;
  fitIn?: boolean;
  durationMinutes?: number;
  notes?: string;
  internalNotes?: string;
  applyToSeries?: boolean;
}

// ---------- Catálogos usados pela agenda / comandas ----------
export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  color: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  professionals: { professionalId: string; price: number | null; durationMinutes: number | null }[];
}

export interface ProfessionalItem {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl?: string | null;
  loyaltyPoints?: number;
  visitsCount?: number;
  club?: { id: string; name: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Preço/duração do serviço considerando valor personalizado do profissional */
export function servicePriceFor(s: ServiceItem, professionalId?: string | null) {
  const custom = professionalId ? s.professionals?.find((p) => p.professionalId === professionalId) : undefined;
  return {
    price: Number(custom?.price ?? s.price ?? 0),
    durationMinutes: Number(custom?.durationMinutes ?? s.durationMinutes ?? 0),
  };
}

export const catalogApi = {
  services: () => api.get<ServiceItem[]>('/services').then((r) => r.data),
  professionals: () => api.get<ProfessionalItem[]>('/professionals').then((r) => r.data),
  searchClients: (search: string, limit = 8) => api.get<Paged<ClientLite>>('/clients', { params: { search: search || undefined, limit } }).then((r) => r.data),
  getClient: (id: string) => api.get<ClientLite>(`/clients/${id}`).then((r) => r.data),
  createClient: (payload: { name: string; phone?: string; email?: string }) => api.post<ClientLite>('/clients', payload).then((r) => r.data),
};

export const appointmentsApi = {
  agenda: (from: string, to: string, professionalId?: string) =>
    api.get<AgendaData>('/appointments/agenda', { params: { from, to, professionalId: professionalId || undefined } }).then((r) => r.data),
  availability: (params: { date: string; professionalId?: string; serviceIds?: string; durationMinutes?: number; ignoreAppointmentId?: string }) =>
    api.get<AvailabilityRow[]>('/appointments/availability', { params }).then((r) => r.data),
  get: (id: string) => api.get<AgendaAppointment>(`/appointments/${id}`).then((r) => r.data),
  create: (payload: CreateAppointmentPayload) => api.post<{ appointment: AgendaAppointment; created: number; skipped: string[] }>('/appointments', payload).then((r) => r.data),
  update: (id: string, payload: UpdateAppointmentPayload) => api.patch<AgendaAppointment>(`/appointments/${id}`, payload).then((r) => r.data),
  changeStatus: (id: string, status: AppointmentStatus, reason?: string, cancelSeries?: boolean) =>
    api.patch<AgendaAppointment>(`/appointments/${id}/status`, { status, reason, cancelSeries }).then((r) => r.data),
  remove: (id: string) => api.delete(`/appointments/${id}`).then((r) => r.data),
  createBlock: (payload: { professionalId?: string; startAt: string; endAt: string; reason?: string }) => api.post<AgendaBlock>('/professionals/blocks', payload).then((r) => r.data),
  removeBlock: (id: string) => api.delete(`/professionals/blocks/${id}`).then((r) => r.data),
};
