import api from './client';
import type { Paged } from './appointments';

export type { Paged };
export type OrderStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type OrderItemType = 'SERVICE' | 'PRODUCT' | 'PACKAGE' | 'CUSTOM';
export type OrderKind = 'CLIENT' | 'PROFESSIONAL_CONSUMPTION';

export interface OrderItem {
  id: string;
  type: OrderItemType;
  serviceId: string | null;
  productId: string | null;
  packageId: string | null;
  clientPackageItemId: string | null;
  professionalId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  total: number;
  commissionPct: number | null;
  commissionAmount: number;
  service: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  professional: { id: string; name: string } | null;
  package: { id: string; name: string } | null;
}

export interface OrderPayment {
  id: string;
  method: string;
  amount: number;
  installments: number;
  feePct: number;
  feeAmount: number;
  netAmount: number;
  reference: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  number: number;
  kind: OrderKind;
  status: OrderStatus;
  clientId: string | null;
  professionalId: string | null;
  subtotal: number;
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  paidTotal: number;
  feesTotal: number;
  addToCashier: boolean;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  cancelledAt?: string | null;
  client: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    loyaltyPoints: number;
    clubId: string | null;
    club: { id: string; name: string; discountPct: number; appliesToServices?: boolean; appliesToProducts?: boolean } | null;
  } | null;
  professional: { id: string; name: string; color: string } | null;
  items: OrderItem[];
  payments: OrderPayment[];
  appointment: { id: string; startAt: string; status: string } | null;
}

export interface OrderSummary {
  date: string;
  open: number;
  closedCount: number;
  revenue: number;
  fees: number;
  byMethod: { method: string; amount: number }[];
}

export interface PaymentMethodConfig {
  id: string;
  method: string;
  label: string | null;
  feePct: number;
  installmentFees: Record<string, number> | null;
  maxInstallments: number;
  isActive: boolean;
}

export interface ProductItem {
  id: string;
  name: string;
  salePrice: number;
  stock: number;
  forSale?: boolean;
  isActive: boolean;
}

export interface PackageItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  validityDays: number | null;
}

export interface ClientPackage {
  id: string;
  expiresAt: string | null;
  isActive: boolean;
  package: { id: string; name: string };
  items: { id: string; serviceId: string | null; productId: string | null; totalQty: number; usedQty: number; service: { id: string; name: string } | null; product: { id: string; name: string } | null }[];
}

export interface OpenOrderPayload {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  professionalId?: string;
  appointmentId?: string;
  kind?: OrderKind;
  notes?: string;
}

export interface AddItemPayload {
  type: OrderItemType;
  serviceId?: string;
  productId?: string;
  packageId?: string;
  clientPackageItemId?: string;
  professionalId?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  commissionPct?: number;
}

export const ordersApi = {
  list: (params: Record<string, string | number | undefined>) => api.get<Paged<Order>>('/orders', { params }).then((r) => r.data),
  summary: (date?: string) => api.get<OrderSummary>('/orders/summary', { params: { date } }).then((r) => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  open: (payload: OpenOrderPayload) => api.post<Order>('/orders', payload).then((r) => r.data),
  addItem: (id: string, payload: AddItemPayload) => api.post<Order>(`/orders/${id}/items`, payload).then((r) => r.data),
  updateItem: (id: string, itemId: string, payload: { professionalId?: string | null; quantity?: number; unitPrice?: number; discountAmount?: number; commissionPct?: number | null }) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}`, payload).then((r) => r.data),
  removeItem: (id: string, itemId: string) => api.delete<Order>(`/orders/${id}/items/${itemId}`).then((r) => r.data),
  update: (id: string, payload: { discountType?: 'PERCENT' | 'AMOUNT' | null; discountValue?: number; addToCashier?: boolean; notes?: string; clientId?: string | null; professionalId?: string | null }) =>
    api.patch<Order>(`/orders/${id}`, payload).then((r) => r.data),
  addPayment: (id: string, payload: { method: string; amount: number; installments?: number; feePct?: number; reference?: string; points?: number }) =>
    api.post<Order>(`/orders/${id}/payments`, payload).then((r) => r.data),
  removePayment: (id: string, paymentId: string) => api.delete<Order>(`/orders/${id}/payments/${paymentId}`).then((r) => r.data),
  close: (id: string, payload: { allowPartial?: boolean } = {}) => api.post<Order>(`/orders/${id}/close`, payload).then((r) => r.data),
  reopen: (id: string) => api.post<Order>(`/orders/${id}/reopen`).then((r) => r.data),
  cancel: (id: string) => api.post<Order>(`/orders/${id}/cancel`).then((r) => r.data),
  paymentMethods: () => api.get<PaymentMethodConfig[]>('/tenant/payment-methods').then((r) => r.data),
  clientPackages: (clientId: string) => api.get<ClientPackage[]>('/packages/clients', { params: { clientId } }).then((r) => r.data),
  products: (search?: string) => api.get<Paged<ProductItem>>('/products', { params: { search: search || undefined, limit: 200 } }).then((r) => r.data),
  packages: () => api.get<PackageItem[]>('/packages').then((r) => r.data),
};
