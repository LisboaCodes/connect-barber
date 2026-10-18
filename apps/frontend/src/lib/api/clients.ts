import api from './client';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit?: number;
  pages: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  gender: string | null;
  document: string | null;
  notes: string | null;
  avatarUrl: string | null;
  tags: string[];
  source: string | null;
  preferredProfessionalId: string | null;
  preferredProfessional?: { id: string; name: string } | null;
  clubId: string | null;
  club?: { id: string; name: string; discountPct?: number } | null;
  clubSince: string | null;
  loyaltyPoints: number;
  visitsCount: number;
  totalSpent: number;
  lastVisitAt: string | null;
  noShowCount: number;
  blocked: boolean;
  marketingOptIn: boolean;
  createdAt: string;
}

export interface ClientPackageItem {
  id: string;
  service?: { name: string } | null;
  product?: { name: string } | null;
  [k: string]: any;
}

export interface ClientPackage {
  id: string;
  pricePaid: number;
  purchasedAt: string;
  expiresAt: string | null;
  package: { id: string; name: string };
  items: ClientPackageItem[];
}

export interface ClientDetail extends Client {
  packages: ClientPackage[];
}

export interface ClientHistory {
  appointments: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    totalPrice: number;
    source: string;
    professional: { id: string; name: string; color: string } | null;
    services: { service: { name: string } }[];
  }[];
  orders: {
    id: string;
    number: number;
    status: string;
    total: number;
    openedAt: string;
    closedAt: string | null;
    items: { id: string; description?: string; name?: string; quantity: number; total: number }[];
    payments: { id: string; method: string; amount: number }[];
  }[];
  loyalty: { id: string; type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE'; points: number; balanceAfter: number; description: string | null; status: string; createdAt: string }[];
  messages: { id: string; channel: string; kind: string; status: string; recipient: string; subject: string | null; content: string; createdAt: string; sentAt: string | null; error: string | null }[];
}

export interface ClientInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  gender?: string;
  notes?: string;
  tags?: string[];
  preferredProfessionalId?: string | null;
  clubId?: string | null;
  marketingOptIn?: boolean;
  blocked?: boolean;
}

export interface ClientListParams {
  search?: string;
  page?: number;
  limit?: number;
  tag?: string;
  clubId?: string;
  inactiveDays?: number;
  sort?: 'name' | 'lastVisit' | 'totalSpent' | 'createdAt';
}

export interface Birthday {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string;
  avatarUrl: string | null;
  lastVisitAt: string | null;
}

export interface Club {
  id: string;
  name: string;
  description?: string | null;
  discountPct?: number;
  isActive?: boolean;
}

export const cleanParams = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false));

export const clientsApi = {
  list: (p: ClientListParams) => api.get<Paged<Client>>('/clients', { params: cleanParams(p) }).then((r) => r.data),
  get: (id: string) => api.get<ClientDetail>(`/clients/${id}`).then((r) => r.data),
  history: (id: string) => api.get<ClientHistory>(`/clients/${id}/history`).then((r) => r.data),
  create: (d: ClientInput) => api.post<Client>('/clients', d).then((r) => r.data),
  update: (id: string, d: Partial<ClientInput>) => api.patch<Client>(`/clients/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/clients/${id}`).then((r) => r.data),
  tags: () => api.get<{ tag: string; count: number }[]>('/clients/tags').then((r) => r.data),
  birthdays: (month: number) => api.get<Birthday[]>('/clients/birthdays', { params: { month } }).then((r) => r.data),
  import: (items: ClientInput[]) => api.post<{ created: number; skipped: number }>('/clients/import', { items }).then((r) => r.data),
  adjustPoints: (id: string, points: number, description?: string) => api.post(`/loyalty/clients/${id}/adjust`, { points, description }).then((r) => r.data),
  clubs: () => api.get<Club[]>('/clubs').then((r) => r.data),
};

/** Datas "date-only" do backend (ex.: 1990-05-20T00:00:00.000Z) -> "yyyy-MM-dd" sem efeito de fuso */
export const dateOnly = (s: string | null | undefined) => (s ? s.slice(0, 10) : '');
