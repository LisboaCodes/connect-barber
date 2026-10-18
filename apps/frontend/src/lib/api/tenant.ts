import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { errorMessage } from './client';

export type OpeningHours = Record<string, { start: string; end: string }[]>;

export interface Tenant {
  onlinePaymentEnabled: boolean;
  kioskEnabled: boolean;
  posEnabled: boolean;
  posProvider: string | null;
  integrations?: { creativePay: boolean; creativePayLast4: string | null; creativePayWebhookSecret: boolean; pos: boolean; posDeviceId: string | null; kioskToken: string | null };
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  siteEnabled: boolean;
  siteAbout: string | null;
  siteGallery: string[] | null;
  siteInstagram: string | null;
  siteFacebook: string | null;
  sitePaymentInfo: string | null;
  onlineBookingEnabled: boolean;
  openingHours: OpeningHours | null;
  slotIntervalMin: number;
  minAdvanceMin: number;
  maxAdvanceDays: number;
  cancelLimitHours: number;
  autoConfirm: boolean;
  requirePrepayment: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  reminderChannels: string[] | null;
  birthdayMessageEnabled: boolean;
  birthdayMessage: string | null;
  surveyEnabled: boolean;
  settings: Record<string, any> | null;
  planCode: string;
  planStatus: string;
  counts?: { professionals: number; services: number; clients: number };
}

export type TenantUpdate = { [K in keyof Omit<Tenant, 'id' | 'counts' | 'planCode' | 'planStatus'>]?: Tenant[K] | undefined };

export type Role = 'OWNER' | 'ADMIN' | 'RECEPTION' | 'PROFESSIONAL';

export interface Member {
  id: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  userId: string;
  user: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; lastLoginAt: string | null };
  professional: { id: string; name: string } | null;
}

export interface MemberInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: Role;
  professionalId?: string;
}

export interface PaymentMethodConfig {
  id?: string;
  method: string;
  label: string | null;
  feePct: number;
  installmentFees: Record<string, number> | null;
  maxInstallments: number;
  isActive: boolean;
}

export const tenantApi = {
  get: () => api.get<Tenant>('/tenant').then((r) => r.data),
  update: (d: TenantUpdate) => api.patch<Tenant>('/tenant', d).then((r) => r.data),
  members: () => api.get<Member[]>('/tenant/members').then((r) => r.data),
  createMember: (d: MemberInput) => api.post<{ membership: Member; generatedPassword?: string; userExisted?: boolean }>('/tenant/members', d).then((r) => r.data),
  updateMember: (id: string, d: { role?: Role; isActive?: boolean; password?: string; professionalId?: string | null }) => api.patch<Member>(`/tenant/members/${id}`, d).then((r) => r.data),
  removeMember: (id: string) => api.delete(`/tenant/members/${id}`).then((r) => r.data),
  paymentMethods: () => api.get<PaymentMethodConfig[]>('/tenant/payment-methods').then((r) => r.data),
  savePaymentMethods: (items: PaymentMethodConfig[]) =>
    api
      .put<PaymentMethodConfig[]>('/tenant/payment-methods', {
        items: items.map((i) => ({
          method: i.method,
          label: i.label || undefined,
          feePct: Number(i.feePct) || 0,
          installmentFees: i.installmentFees ?? undefined,
          maxInstallments: Number(i.maxInstallments) || 1,
          isActive: i.isActive,
        })),
      })
      .then((r) => r.data),
};

export const TENANT_KEY = ['tenant'] as const;

export function useTenant() {
  return useQuery({ queryKey: TENANT_KEY, queryFn: tenantApi.get });
}

/** PATCH /tenant com toast e atualização do cache */
export function useUpdateTenant(successMessage = 'Configurações salvas') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenantApi.update,
    onSuccess: (t) => {
      qc.setQueryData(TENANT_KEY, (old: Tenant | undefined) => (old ? { ...old, ...t } : t));
      toast.success(successMessage);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
