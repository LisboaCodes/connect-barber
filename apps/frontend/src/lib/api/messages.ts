import api from './client';
import { cleanParams } from './reports';

export type MessageKind = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'RETURN' | 'BIRTHDAY' | 'CAMPAIGN' | 'WAITLIST' | 'SURVEY' | 'LOYALTY' | 'OTHER';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface MessageLog {
  id: string;
  clientId: string | null;
  client: { id: string; name: string } | null;
  channel: 'WHATSAPP' | 'EMAIL' | 'PUSH' | 'INAPP';
  kind: MessageKind;
  status: MessageStatus;
  recipient: string;
  subject: string | null;
  content: string;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MessagesResponse {
  items: MessageLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  providers: { email: boolean; whatsapp: boolean };
}

export const messagesApi = {
  list: (q: { kind?: string; status?: string; clientId?: string; page?: number; limit?: number }) => api.get<MessagesResponse>('/messages', { params: cleanParams(q) }).then((r) => r.data),
};

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  CONFIRMATION: 'Confirmação',
  REMINDER: 'Lembrete',
  CANCELLATION: 'Cancelamento',
  RETURN: 'Retorno',
  BIRTHDAY: 'Aniversário',
  CAMPAIGN: 'Campanha',
  WAITLIST: 'Lista de espera',
  SURVEY: 'Pesquisa',
  LOYALTY: 'Fidelidade',
  OTHER: 'Outro',
};

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  PENDING: 'Pendente',
  SENT: 'Enviada',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  FAILED: 'Falhou',
};

export const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  PUSH: 'Push',
  INAPP: 'No app',
};
