import api from './client';

export interface Period {
  from: string;
  to: string;
}

export interface DashboardData {
  period: Period;
  kpis: {
    revenue: number;
    prevRevenue: number;
    revenueChangePct: number | null;
    ordersCount: number;
    averageTicket: number;
    discounts: number;
    cardFees: number;
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRatePct: number;
    newClients: number;
    openOrders: number;
    cashierOpen: boolean;
    lowStockCount: number;
    pendingPayables: number;
    pendingReceivables: number;
  };
  daily: { day: string; total: number; count: number }[];
  byMethod: { method: string; amount: number }[];
  topServices: { id: string | null; name: string; total: number; quantity: number }[];
  topProducts: { id: string | null; name: string; total: number; quantity: number }[];
  byProfessional: { id: string | null; name: string; color?: string | null; total: number; commission: number; items: number }[];
  todayAppointments: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    guestName?: string | null;
    client: { name: string } | null;
    professional: { name: string; color: string | null } | null;
    services: { service: { name: string } | null }[];
  }[];
  birthdaysToday: { id: string; name: string; phone: string | null; birthDate: string }[];
}

export interface AggRow<K = string | number> {
  key: K;
  count: number;
  revenue: number;
}

export interface AppointmentsReport {
  byWeekday: AggRow<number>[];
  byHour: AggRow<number>[];
  bySource: AggRow<string>[];
  byStatus: AggRow<string>[];
  topClients: { id: string | null; name: string; phone?: string | null; count: number }[];
  byProfessional: { id: string; name: string; color: string | null; total: number; completed: number; cancelled: number; noShow: number }[];
}

export interface OccupancyReport {
  from: string;
  to: string;
  professionals: { id: string; name: string; color: string | null; availableMin: number; bookedMin: number; occupancyPct: number }[];
  average: number;
}

export interface RetentionReport {
  from: string;
  to: string;
  windowDays: number;
  clients: number;
  returned: number;
  returnRatePct: number;
  inactiveClients: number;
}

export interface FinancialReport {
  period: Period & { timezone: string };
  revenue: { total: number; services: number; products: number; packages: number; other: number; discounts: number; orders: number; averageTicket: number; otherIncome: number };
  byMethod: { method: string; amount: number; fees: number; net: number }[];
  expenses: { total: number; byCategory: { category: string; amount: number }[]; commissions: number; productsCost: number; cardFees: number };
  result: { grossProfit: number; netResult: number };
}

export interface MovementOrder {
  id: string;
  number: number;
  kind: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  feesTotal: number;
  closedAt: string | null;
  client: { name: string; phone: string | null } | null;
  professional: { name: string } | null;
  items: { id: string; type: string; description: string; quantity: number; unitPrice: number; total: number; commissionAmount: number; professional: { name: string } | null }[];
  payments: { id: string; method: string; amount: number; feeAmount: number; netAmount: number; installments: number }[];
}

export interface AverageTicketReport {
  perOrder: number;
  perClient: number;
  orders: number;
  clients: number;
  total: number;
  byProfessional: { id: string; name: string; average: number; count: number; total: number }[];
}

/** Remove chaves vazias de um objeto de parâmetros */
export function cleanParams<T extends object>(p: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== '' && v !== undefined && v !== null) out[k] = v;
  return out as Partial<T>;
}

export const reportsApi = {
  dashboard: (p: Period) => api.get<DashboardData>('/reports/dashboard', { params: p }).then((r) => r.data),
  appointments: (p: Period & { professionalId?: string }) => api.get<AppointmentsReport>('/reports/appointments', { params: cleanParams(p) }).then((r) => r.data),
  occupancy: (p: Period) => api.get<OccupancyReport>('/reports/occupancy', { params: p }).then((r) => r.data),
  retention: (p: Period & { windowDays?: number }) => api.get<RetentionReport>('/reports/retention', { params: p }).then((r) => r.data),
  financial: (p: Period) => api.get<FinancialReport>('/reports/financial', { params: p }).then((r) => r.data),
  movements: (p: Period) => api.get<MovementOrder[]>('/reports/movements', { params: p }).then((r) => r.data),
  averageTicket: (p: Period) => api.get<AverageTicketReport>('/reports/average-ticket', { params: p }).then((r) => r.data),
};
