import api from './client';

export interface ServiceCategory {
  id: string;
  name: string;
  displayOrder: number;
  _count?: { services: number };
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  durationMinutes: number;
  price: number;
  costPrice: number | null;
  commissionPct: number | null;
  color: string | null;
  imageUrl: string | null;
  displayOrder: number;
  allowOnlineBooking: boolean;
  returnDays: number | null;
  loyaltyPoints: number | null;
  isActive: boolean;
  professionals: { professionalId: string; price: number | null; durationMinutes: number | null }[];
}

export interface ServiceInput {
  name: string;
  categoryId?: string | null;
  durationMinutes: number;
  price: number;
  costPrice?: number;
  commissionPct?: number | null;
  color?: string;
  description?: string;
  allowOnlineBooking?: boolean;
  returnDays?: number | null;
  loyaltyPoints?: number | null;
  professionalIds?: string[];
  isActive?: boolean;
  displayOrder?: number;
}

export const servicesApi = {
  list: (includeInactive = false) => api.get<Service[]>('/services', { params: includeInactive ? { includeInactive: 'true' } : {} }).then((r) => r.data),
  create: (d: ServiceInput) => api.post<Service>('/services', d).then((r) => r.data),
  update: (id: string, d: Partial<ServiceInput>) => api.patch<Service>(`/services/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/services/${id}`).then((r) => r.data),
  reorder: (ids: string[]) => api.put('/services/reorder', { ids }).then((r) => r.data),
  categories: () => api.get<ServiceCategory[]>('/services/categories').then((r) => r.data),
  createCategory: (d: { name: string; displayOrder?: number }) => api.post<ServiceCategory>('/services/categories', d).then((r) => r.data),
  updateCategory: (id: string, d: { name: string; displayOrder?: number }) => api.patch<ServiceCategory>(`/services/categories/${id}`, d).then((r) => r.data),
  removeCategory: (id: string) => api.delete(`/services/categories/${id}`).then((r) => r.data),
};
