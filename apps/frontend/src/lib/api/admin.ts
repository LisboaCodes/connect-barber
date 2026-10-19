import api from './client';

export interface AdminOverview {
  tenants: number;
  byStatus: { status: string; count: number }[];
  users: number;
  appointmentsLast30d: number;
  gmvLast30d: number;
  mrr: number;
  openInvoices: { count: number; amount: number };
}

export interface AdminTenantRow {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  addressCity: string | null;
  addressState: string | null;
  planCode: string;
  planStatus: string;
  trialEndsAt: string | null;
  planRenewsAt: string | null;
  createdAt: string;
  isActive: boolean;
  onboardingStep: number;
  _count: { professionals: number; clients: number; appointments: number };
}

export interface AdminIntegrations {
  creativePay: { configured: boolean; ok: boolean; error?: string };
  email: { configured: boolean };
  whatsapp: { configured: boolean };
  messagesLast7d: { sent: number; failed: number };
}

export interface AdminInvoiceRow {
  id: string;
  planCode: string;
  amount: number | string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  paidAt: string | null;
  checkoutUrl: string | null;
  tenant: { id: string; name: string; slug: string; email: string | null; phone: string | null; planStatus: string };
}

export const adminApi = {
  overview: async () => (await api.get<AdminOverview>('/admin/overview')).data,
  tenants: async (params: Record<string, any>) => (await api.get<{ items: AdminTenantRow[]; total: number; page: number; pages: number }>('/admin/tenants', { params })).data,
  tenant: async (id: string) => (await api.get<any>(`/admin/tenants/${id}`)).data,
  updateTenant: async (id: string, body: Record<string, any>) => (await api.patch(`/admin/tenants/${id}`, body)).data,
  payInvoice: async (id: string) => (await api.post(`/admin/invoices/${id}/pay`)).data,
  invoiceCheckout: async (id: string) => (await api.post<{ checkoutUrl: string; invoiceId: string }>(`/admin/invoices/${id}/checkout`)).data,
  invoices: async (params: Record<string, any>) => (await api.get<{ items: AdminInvoiceRow[]; total: number; page: number; pages: number }>('/admin/invoices', { params })).data,
  integrations: async () => (await api.get<AdminIntegrations>('/admin/integrations')).data,
};
