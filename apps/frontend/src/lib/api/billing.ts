import api from './client';

export interface PlanDef {
  code: string;
  name: string;
  minProfessionals: number;
  maxProfessionals: number;
  monthlyPrice: number;
  promoPrice: number;
  description: string;
}

export interface Invoice {
  id: string;
  planCode: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null;
  checkoutUrl: string | null;
}

export interface BillingOverview {
  plan: PlanDef;
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  renewsAt: string | null;
  activeProfessionals: number;
  suggestedPlan: PlanDef;
  plans: PlanDef[];
  invoices: Invoice[];
  onlinePayments: boolean;
}

export const billingApi = {
  plans: async () => (await api.get<PlanDef[]>('/public/plans')).data,
  overview: async () => (await api.get<BillingOverview>('/billing')).data,
  subscribe: async (planCode: string) => (await api.post<{ invoice: Invoice; checkoutUrl: string | null; manual?: boolean }>('/billing/subscribe', { planCode })).data,
};
