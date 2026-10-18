import api from './client';

export interface MyAppointment {
  id: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    cancelLimitHours: number;
    addressStreet: string | null;
    addressNumber: string | null;
    addressDistrict: string | null;
    addressCity: string | null;
    phone: string | null;
    whatsapp: string | null;
  };
  startAt: string;
  endAt: string;
  status: string;
  professional: { id: string; name: string; avatarUrl: string | null } | null;
  services: { name: string; price: number; durationMinutes: number }[];
  totalPrice: number;
  totalDuration: number;
  notes: string | null;
  cancelReason: string | null;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  pointsCost: number;
  discountAmount: number | string | null;
  isActive: boolean;
}

export interface LoyaltyProgramInfo {
  id: string;
  tenantId: string;
  isActive: boolean;
  name: string;
  description: string | null;
  pointsPerCurrency: number | string;
  pointsExpireDays: number | null;
  rewards: LoyaltyReward[];
}

export interface MyBarbershop {
  clientId: string;
  tenant: { id: string; name: string; slug: string; logoUrl: string | null };
  loyaltyPoints: number;
  visitsCount: number;
  lastVisitAt: string | null;
  club: { name: string; discountPct: number | string } | null;
  packages: {
    id: string;
    expiresAt: string | null;
    package: { name: string };
    items: { id: string; totalQty: number; usedQty: number; service?: { name: string } | null; product?: { name: string } | null }[];
  }[];
  program: LoyaltyProgramInfo | null;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';
  points: number;
  balanceAfter: number;
  description: string | null;
  status: string;
  createdAt: string;
  reward: { name: string } | null;
}

export interface MyLoyalty {
  points: number;
  program: LoyaltyProgramInfo | null;
  transactions: LoyaltyTransaction[];
}

export const clientAreaApi = {
  appointments: () => api.get<MyAppointment[]>('/me/appointments').then((r) => r.data),
  cancel: (id: string) => api.post(`/me/appointments/${id}/cancel`).then((r) => r.data),
  barbershops: () => api.get<MyBarbershop[]>('/me/barbershops').then((r) => r.data),
  loyalty: (clientId: string) => api.get<MyLoyalty>(`/me/barbershops/${clientId}/loyalty`).then((r) => r.data),
  redeem: (clientId: string, rewardId: string) => api.post(`/me/barbershops/${clientId}/redeem/${rewardId}`).then((r) => r.data),
  updatePhone: (phone: string) => api.patch('/me/phone', { phone }).then((r) => r.data),
};
