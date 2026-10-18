import api from './client';
import { cleanParams } from './reports';

export interface ProfessionalLite {
  id: string;
  name: string;
  color: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface CommissionSummaryRow {
  professional: ProfessionalLite & { serviceCommissionPct: number; productCommissionPct: number };
  pending: number;
  pendingCount: number;
  paid: number;
  base: number;
  services: number;
  products: number;
  openAdvances: number;
}

export interface CommissionEntry {
  id: string;
  professionalId: string;
  baseAmount: number;
  pct: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  referenceDate: string;
  payoutId: string | null;
  professional: { id: string; name: string };
  order: { id: string; number: number; closedAt: string | null; client: { name: string } | null } | null;
  orderItem: { description: string; type: string; quantity: number } | null;
}

export interface Advance {
  id: string;
  professionalId: string;
  amount: number;
  description: string | null;
  date: string;
  status: 'OPEN' | 'SETTLED' | 'CANCELLED';
  payoutId: string | null;
  professional?: { id: string; name: string };
}

export interface Payout {
  id: string;
  professionalId: string;
  professional: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  commissionsTotal: number;
  advancesTotal: number;
  consumptionTotal: number;
  netAmount: number;
  paidAt: string | null;
  method: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PayoutDetail extends Payout {
  entries: { id: string; amount: number; baseAmount: number; pct: number; referenceDate: string; orderItem: { description: string; type: string } | null; order: { number: number; closedAt: string | null } | null }[];
  advances: Advance[];
}

export interface PayoutInput {
  professionalId: string;
  periodStart: string;
  periodEnd: string;
  deductAdvances?: boolean;
  deductConsumption?: boolean;
  paid?: boolean;
  method?: string;
  notes?: string;
  addToCashier?: boolean;
}

export interface PayoutPreview {
  professional: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  entries: { id: string; amount: number; baseAmount: number; pct: number; referenceDate: string; orderItem: { description: string; type: string } | null; order: { number: number } | null }[];
  advances: Advance[];
  consumption: { id: string; number: number; total: number; closedAt: string }[];
  commissionsTotal: number;
  advancesTotal: number;
  consumptionTotal: number;
  netAmount: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const commissionsApi = {
  professionals: () => api.get<ProfessionalLite[]>('/professionals').then((r) => r.data),
  summary: (from: string, to: string, professionalId?: string) => api.get<CommissionSummaryRow[]>('/commissions/summary', { params: cleanParams({ from, to, professionalId }) }).then((r) => r.data),
  entries: (q: { from?: string; to?: string; professionalId?: string; status?: string; page?: number; limit?: number }) => api.get<Paged<CommissionEntry>>('/commissions/entries', { params: cleanParams(q) }).then((r) => r.data),
  advances: (q: { professionalId?: string; status?: string } = {}) => api.get<Advance[]>('/commissions/advances', { params: cleanParams(q) }).then((r) => r.data),
  createAdvance: (d: { professionalId: string; amount: number; date?: string; description?: string; addToCashier?: boolean }) => api.post<Advance>('/commissions/advances', d).then((r) => r.data),
  cancelAdvance: (id: string) => api.delete(`/commissions/advances/${id}`).then((r) => r.data),
  payouts: (professionalId?: string) => api.get<Payout[]>('/commissions/payouts', { params: cleanParams({ professionalId }) }).then((r) => r.data),
  preview: (d: PayoutInput) => api.post<PayoutPreview>('/commissions/payouts/preview', d).then((r) => r.data),
  createPayout: (d: PayoutInput) => api.post<PayoutDetail>('/commissions/payouts', d).then((r) => r.data),
  payout: (id: string) => api.get<PayoutDetail>(`/commissions/payouts/${id}`).then((r) => r.data),
  payPayout: (id: string, d: { method?: string; addToCashier?: boolean }) => api.post<PayoutDetail>(`/commissions/payouts/${id}/pay`, d).then((r) => r.data),
  deletePayout: (id: string) => api.delete(`/commissions/payouts/${id}`).then((r) => r.data),
};
