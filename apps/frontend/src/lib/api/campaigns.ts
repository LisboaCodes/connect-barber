import api from './client';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
export type Channel = 'WHATSAPP' | 'EMAIL';

export interface Audience {
  all?: boolean;
  tags?: string[];
  clubId?: string;
  inactiveDays?: number;
  birthdayMonth?: number;
  professionalId?: string;
  minVisits?: number;
}

export interface Campaign {
  id: string;
  title: string;
  content: string;
  channels: Channel[];
  audience: Audience | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  totalSent: number;
  totalRead: number;
  createdAt: string;
}

export interface CampaignDetail extends Campaign {
  recipients: { id: string; clientId: string; sentAt: string | null; deliveredAt: string | null; readAt: string | null; error: string | null; client: { id: string; name: string; phone: string | null; email: string | null } }[];
}

export interface CampaignInput {
  title: string;
  content: string;
  channels: Channel[];
  audience?: Audience;
  scheduledAt?: string | null;
}

export interface AudiencePreview {
  count: number;
  sample: { id: string; name: string; phone: string | null; email: string | null }[];
}

export const campaignsApi = {
  list: () => api.get<Campaign[]>('/campaigns').then((r) => r.data),
  get: (id: string) => api.get<CampaignDetail>(`/campaigns/${id}`).then((r) => r.data),
  create: (d: CampaignInput) => api.post<Campaign>('/campaigns', d).then((r) => r.data),
  update: (id: string, d: CampaignInput) => api.patch<Campaign>(`/campaigns/${id}`, d).then((r) => r.data),
  preview: (audience: Audience) => api.post<AudiencePreview>('/campaigns/audience/preview', { audience }).then((r) => r.data),
  send: (id: string) => api.post<Campaign>(`/campaigns/${id}/send`, {}, { timeout: 300000 }).then((r) => r.data),
  cancel: (id: string) => api.post<Campaign>(`/campaigns/${id}/cancel`).then((r) => r.data),
  remove: (id: string) => api.delete(`/campaigns/${id}`).then((r) => r.data),
  // apoio
  tags: () => api.get<{ tag: string; count: number }[]>('/clients/tags').then((r) => r.data),
  clubs: () => api.get<{ id: string; name: string }[]>('/clubs').then((r) => r.data),
  professionals: () => api.get<{ id: string; name: string }[]>('/professionals').then((r) => r.data),
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  CANCELLED: 'Cancelada',
};
