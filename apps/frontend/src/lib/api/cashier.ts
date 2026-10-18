import api from './client';
import type { Paged } from './appointments';

export type CashMovementType = 'SALE' | 'INCOME' | 'EXPENSE' | 'WITHDRAWAL' | 'SUPPLY';

export interface CashierSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedById: string;
  closedById: string | null;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  expectedBalance: number | null;
  closingBalance: number | null;
  difference: number | null;
  notes: string | null;
  openedBy?: string | null;
  closedBy?: string | null;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  method: string;
  amount: number;
  description: string | null;
  paymentId: string | null;
  createdAt: string;
}

export interface CashierSummary {
  openingBalance: number;
  sales: number;
  income: number;
  expense: number;
  withdrawal: number;
  supply: number;
  byMethod: { method: string; amount: number }[];
  expectedCash: number;
  total: number;
  movements: CashMovement[];
}

export interface CashierState {
  session: CashierSession | null;
  summary: CashierSummary | null;
}

export const MOVEMENT_LABEL: Record<CashMovementType, string> = {
  SALE: 'Venda (comanda)',
  INCOME: 'Entrada',
  EXPENSE: 'Despesa',
  WITHDRAWAL: 'Sangria',
  SUPPLY: 'Suprimento',
};

export const cashierApi = {
  current: () => api.get<CashierState>('/cashier/current').then((r) => r.data),
  open: (payload: { openingBalance: number; notes?: string }) => api.post<CashierSession>('/cashier/open', payload).then((r) => r.data),
  close: (payload: { closingBalance: number; notes?: string }) => api.post<CashierSession>('/cashier/close', payload).then((r) => r.data),
  addMovement: (payload: { type: Exclude<CashMovementType, 'SALE'>; amount: number; method?: string; description?: string }) =>
    api.post<CashMovement>('/cashier/movements', payload).then((r) => r.data),
  removeMovement: (id: string) => api.delete(`/cashier/movements/${id}`).then((r) => r.data),
  history: (params: { from?: string; to?: string; page?: number; limit?: number }) => api.get<Paged<CashierSession>>('/cashier/history', { params }).then((r) => r.data),
  session: (id: string) => api.get<{ session: CashierSession; summary: CashierSummary }>(`/cashier/sessions/${id}`).then((r) => r.data),
};
