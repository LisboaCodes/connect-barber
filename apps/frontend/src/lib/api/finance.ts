import api from './client';
import { cleanParams } from './reports';

export type FinanceType = 'INCOME' | 'EXPENSE';
export type FinanceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface FinanceCategory {
  id: string;
  name: string;
  type: FinanceType;
  isSystem: boolean;
}

export interface FinanceEntry {
  id: string;
  type: FinanceType;
  status: FinanceStatus;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  description: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paidAmount: number | null;
  method: string | null;
  supplier: string | null;
  notes: string | null;
  orderId: string | null;
  installment: number | null;
  installments: number | null;
  overdue: boolean;
  createdAt: string;
}

export interface FinanceListQuery {
  type?: FinanceType;
  status?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  search?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface FinanceList {
  items: FinanceEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  totals: { type: FinanceType; status: FinanceStatus; amount: number; paid: number }[];
}

export interface CreateFinanceEntry {
  type: FinanceType;
  description: string;
  amount: number;
  dueDate: string;
  categoryId?: string | null;
  supplier?: string;
  notes?: string;
  installments?: number;
  paid?: boolean;
  method?: string;
  addToCashier?: boolean;
}

export type UpdateFinanceEntry = Partial<Pick<CreateFinanceEntry, 'description' | 'amount' | 'dueDate' | 'categoryId' | 'supplier' | 'notes'>>;

export interface PayFinanceEntry {
  paidAmount?: number;
  paidAt?: string;
  method?: string;
  addToCashier?: boolean;
}

export interface CashflowDay {
  day: string;
  sales: number;
  otherIncome: number;
  expenses: number;
  commissions: number;
  balance: number;
}

export interface Cashflow {
  from: string;
  to: string;
  days: CashflowDay[];
  totals: { sales: number; otherIncome: number; expenses: number; commissions: number; cardFees: number; balance: number };
  pending: { type: FinanceType; amount: number }[];
}

export const financeApi = {
  list: (q: FinanceListQuery) => api.get<FinanceList>('/finance/entries', { params: cleanParams({ ...q, overdue: q.overdue ? 'true' : undefined }) }).then((r) => r.data),
  create: (d: CreateFinanceEntry) => api.post<FinanceEntry[]>('/finance/entries', d).then((r) => r.data),
  update: (id: string, d: UpdateFinanceEntry) => api.patch<FinanceEntry>(`/finance/entries/${id}`, d).then((r) => r.data),
  pay: (id: string, d: PayFinanceEntry) => api.post<FinanceEntry>(`/finance/entries/${id}/pay`, d).then((r) => r.data),
  unpay: (id: string) => api.post<FinanceEntry>(`/finance/entries/${id}/unpay`).then((r) => r.data),
  cancel: (id: string) => api.post<FinanceEntry>(`/finance/entries/${id}/cancel`).then((r) => r.data),
  remove: (id: string) => api.delete(`/finance/entries/${id}`).then((r) => r.data),
  cashflow: (from: string, to: string) => api.get<Cashflow>('/finance/cashflow', { params: { from, to } }).then((r) => r.data),
  categories: () => api.get<FinanceCategory[]>('/finance/categories').then((r) => r.data),
  createCategory: (d: { name: string; type: FinanceType }) => api.post<FinanceCategory>('/finance/categories', d).then((r) => r.data),
  updateCategory: (id: string, d: { name: string; type: FinanceType }) => api.patch<FinanceCategory>(`/finance/categories/${id}`, d).then((r) => r.data),
  removeCategory: (id: string) => api.delete(`/finance/categories/${id}`).then((r) => r.data),
};

/** Formas de pagamento aceitas em lançamentos manuais */
export const FINANCE_METHODS = ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER'] as const;
