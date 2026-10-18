import api from './client';
import { cleanParams } from './reports';

export interface LoyaltyReward {
  id: string;
  name: string;
  pointsCost: number;
  serviceId: string | null;
  productId: string | null;
  discountAmount: number | null;
  isActive: boolean;
  service?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
}

export interface LoyaltyProgram {
  id: string;
  isActive: boolean;
  name: string;
  pointsPerCurrency: number;
  includeProducts: boolean;
  pointsExpireDays: number | null;
  description: string | null;
  rewards: LoyaltyReward[];
}

export type LoyaltyProgramInput = Partial<Omit<LoyaltyProgram, 'id' | 'rewards'>>;

export interface RewardInput {
  name: string;
  pointsCost: number;
  serviceId?: string | null;
  productId?: string | null;
  discountAmount?: number | null;
  isActive?: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  clientId: string;
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';
  points: number;
  balanceAfter: number;
  description: string | null;
  status: string;
  createdAt: string;
  client: { id: string; name: string; phone: string | null };
  reward: LoyaltyReward | null;
}

export interface RankingRow {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
  visitsCount: number;
}

export interface PackageItem {
  id?: string;
  serviceId: string | null;
  productId: string | null;
  quantity: number;
  service?: { id: string; name: string; price: number } | null;
  product?: { id: string; name: string; salePrice: number } | null;
}

export interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  validityDays: number | null;
  isActive: boolean;
  sellOnline: boolean;
  items: PackageItem[];
  _count?: { clientPackages: number };
}

export interface PackageInput {
  name: string;
  description?: string;
  price: number;
  validityDays?: number | null;
  isActive?: boolean;
  sellOnline?: boolean;
  items: { serviceId?: string; productId?: string; quantity: number }[];
}

export interface ClientPackageRow {
  id: string;
  pricePaid: number;
  purchasedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  client: { id: string; name: string };
  package: { id: string; name: string };
  items: { id: string; totalQty: number; usedQty: number; service: { id: string; name: string } | null; product: { id: string; name: string } | null }[];
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  discountPct: number;
  appliesToServices: boolean;
  appliesToProducts: boolean;
  monthlyFee: number | null;
  isActive: boolean;
  _count?: { clients: number };
}

export interface ClubInput {
  name: string;
  description?: string;
  discountPct: number;
  appliesToServices?: boolean;
  appliesToProducts?: boolean;
  monthlyFee?: number | null;
  isActive?: boolean;
}

export interface ServiceLite {
  id: string;
  name: string;
  price: number;
}
export interface ProductLite {
  id: string;
  name: string;
  salePrice: number;
}
export interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  loyaltyPoints?: number;
}

export const loyaltyApi = {
  program: () => api.get<LoyaltyProgram>('/loyalty/program').then((r) => r.data),
  updateProgram: (d: LoyaltyProgramInput) => api.put<LoyaltyProgram>('/loyalty/program', d).then((r) => r.data),
  createReward: (d: RewardInput) => api.post<LoyaltyReward>('/loyalty/rewards', d).then((r) => r.data),
  updateReward: (id: string, d: RewardInput) => api.patch<LoyaltyReward>(`/loyalty/rewards/${id}`, d).then((r) => r.data),
  removeReward: (id: string) => api.delete(`/loyalty/rewards/${id}`).then((r) => r.data),
  ranking: () => api.get<RankingRow[]>('/loyalty/ranking').then((r) => r.data),
  transactions: (q: { clientId?: string; status?: string; limit?: number } = {}) => api.get<LoyaltyTransaction[]>('/loyalty/transactions', { params: cleanParams(q) }).then((r) => r.data),
  confirm: (id: string) => api.post(`/loyalty/transactions/${id}/confirm`).then((r) => r.data),
  cancel: (id: string) => api.post(`/loyalty/transactions/${id}/cancel`).then((r) => r.data),
  adjust: (clientId: string, d: { points: number; description?: string }) => api.post(`/loyalty/clients/${clientId}/adjust`, d).then((r) => r.data),

  packages: (includeInactive = false) => api.get<PackageRow[]>('/packages', { params: includeInactive ? { includeInactive: 'true' } : {} }).then((r) => r.data),
  clientPackages: (q: { clientId?: string; all?: boolean } = {}) => api.get<ClientPackageRow[]>('/packages/clients', { params: cleanParams({ clientId: q.clientId, all: q.all ? 'true' : undefined }) }).then((r) => r.data),
  createPackage: (d: PackageInput) => api.post<PackageRow>('/packages', d).then((r) => r.data),
  updatePackage: (id: string, d: PackageInput) => api.patch<PackageRow>(`/packages/${id}`, d).then((r) => r.data),
  removePackage: (id: string) => api.delete(`/packages/${id}`).then((r) => r.data),

  clubs: () => api.get<Club[]>('/clubs').then((r) => r.data),
  createClub: (d: ClubInput) => api.post<Club>('/clubs', d).then((r) => r.data),
  updateClub: (id: string, d: ClubInput) => api.patch<Club>(`/clubs/${id}`, d).then((r) => r.data),
  removeClub: (id: string) => api.delete(`/clubs/${id}`).then((r) => r.data),

  // apoio (listas para seletores)
  services: () => api.get<ServiceLite[]>('/services').then((r) => r.data),
  products: () => api.get<{ items: ProductLite[] }>('/products', { params: { limit: 200 } }).then((r) => r.data.items),
  searchClients: (search: string) => api.get<{ items: ClientLite[] }>('/clients', { params: { search, limit: 10 } }).then((r) => r.data.items),
};
