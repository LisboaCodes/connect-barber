import api from './client';
import { cleanParams } from './reports';

export interface Survey {
  id: string;
  rating: number | null;
  comment: string | null;
  sentAt: string | null;
  answeredAt: string | null;
  createdAt: string;
  professionalId: string | null;
  client: { id: string; name: string } | null;
  professional: { id: string; name: string } | null;
}

export interface SurveysResponse {
  items: Survey[];
  summary: {
    sent: number;
    answered: number;
    average: number | null;
    distribution: { rating: number; count: number }[];
    byProfessional: { professionalId: string | null; average: number | null; count: number }[];
  };
}

export const surveysApi = {
  list: (q: { from?: string; to?: string; professionalId?: string; answered?: 'true' | 'false' | '' }) => api.get<SurveysResponse>('/surveys', { params: cleanParams(q) }).then((r) => r.data),
};
