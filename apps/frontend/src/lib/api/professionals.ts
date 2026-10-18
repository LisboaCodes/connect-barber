import api from './client';

export interface WorkSchedule {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleOverride {
  id: string;
  date: string;
  type: 'OFF' | 'EXTRA';
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export interface Professional {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  color: string;
  displayOrder: number;
  showOnSite: boolean;
  acceptsOnlineBooking: boolean;
  serviceCommissionPct: number;
  productCommissionPct: number;
  isActive: boolean;
  membershipId: string | null;
  membership: { id: string; role: string; isActive: boolean; user: { id: string; email: string; name: string } } | null;
  services: { serviceId: string; price: number | null; durationMinutes: number | null }[];
  workSchedules: WorkSchedule[];
}

export interface ProfessionalInput {
  name: string;
  phone?: string;
  email?: string;
  bio?: string;
  color?: string;
  displayOrder?: number;
  showOnSite?: boolean;
  acceptsOnlineBooking?: boolean;
  serviceCommissionPct?: number;
  productCommissionPct?: number;
  isActive?: boolean;
  serviceIds?: string[];
  createAccess?: boolean;
  password?: string;
}

export interface OverrideInput {
  date: string;
  type: 'OFF' | 'EXTRA';
  startTime?: string;
  endTime?: string;
  reason?: string;
}

type WithPassword<T> = T & { generatedPassword?: string };

export const professionalsApi = {
  list: (includeInactive = false) => api.get<Professional[]>('/professionals', { params: includeInactive ? { includeInactive: 'true' } : {} }).then((r) => r.data),
  get: (id: string) => api.get<Professional & { scheduleOverrides: ScheduleOverride[] }>(`/professionals/${id}`).then((r) => r.data),
  create: (d: ProfessionalInput) => api.post<WithPassword<Professional>>('/professionals', d).then((r) => r.data),
  update: (id: string, d: Partial<ProfessionalInput>) => api.patch<WithPassword<Professional>>(`/professionals/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/professionals/${id}`).then((r) => r.data),
  setSchedule: (id: string, ranges: WorkSchedule[]) =>
    api.put<WorkSchedule[]>(`/professionals/${id}/schedule`, { ranges: ranges.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })) }).then((r) => r.data),
  overrides: (id: string, from?: string, to?: string) => api.get<ScheduleOverride[]>(`/professionals/${id}/overrides`, { params: { from, to } }).then((r) => r.data),
  createOverride: (id: string, d: OverrideInput) => api.post<ScheduleOverride>(`/professionals/${id}/overrides`, d).then((r) => r.data),
  removeOverride: (id: string, overrideId: string) => api.delete(`/professionals/${id}/overrides/${overrideId}`).then((r) => r.data),
};
