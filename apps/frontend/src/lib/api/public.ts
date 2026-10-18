import api from './client';

export interface TimeRange {
  start: string;
  end: string;
}

export interface PublicProfessional {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  color: string | null;
  acceptsOnlineBooking: boolean;
  services: { serviceId: string }[];
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | string;
  categoryId: string | null;
  imageUrl?: string | null;
  allowOnlineBooking: boolean;
  professionals: { professionalId: string }[];
}

export interface PublicCategory {
  id: string;
  name: string;
  displayOrder: number;
}

export interface PublicPackage {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  validityDays: number | null;
  items: { id: string; quantity: number; service?: { name: string } | null; product?: { name: string } | null }[];
}

export interface PublicAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
}

export interface PublicBarbershop {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  about: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  gallery: string[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  paymentInfo: string | null;
  address: PublicAddress;
  openingHours: Record<string, TimeRange[]> | null;
  timezone: string;
  onlineBookingEnabled: boolean;
  cancelLimitHours: number;
  minAdvanceMin: number;
  maxAdvanceDays: number;
  professionals: PublicProfessional[];
  services: PublicService[];
  categories: PublicCategory[];
  packages: PublicPackage[];
  loyalty: { isActive: boolean; name: string; description: string | null; pointsPerCurrency: number | string } | null;
  rating: { average: number; count: number } | null;
}

export interface AvailabilityItem {
  professionalId: string;
  professionalName: string;
  color: string | null;
  off: boolean;
  slots: string[];
}

export interface BookingPayload {
  professionalId: string;
  serviceIds: string[];
  date: string;
  time: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface BookedAppointment {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  professional?: { id: string; name: string } | null;
  services: { name: string; price: number; durationMinutes: number }[];
  totalPrice: number;
  totalDuration?: number;
}

export interface WaitlistPayload {
  date: string;
  professionalId?: string;
  serviceId?: string;
  name?: string;
  phone?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface PublicSurvey {
  id: string;
  rating: number | null;
  comment: string | null;
  answeredAt: string | null;
  tenant: { name: string; logoUrl: string | null; slug: string };
  professional: { name: string } | null;
  appointment: { startAt: string; services: { service: { name: string } | null }[] } | null;
}

export const publicApi = {
  barbershop: (slug: string) => api.get<PublicBarbershop>(`/public/barbershops/${slug}`).then((r) => r.data),
  availability: (slug: string, params: { date: string; professionalId?: string; serviceIds: string[] }) =>
    api
      .get<AvailabilityItem[]>(`/public/barbershops/${slug}/availability`, {
        params: { date: params.date, professionalId: params.professionalId || undefined, serviceIds: params.serviceIds.join(',') },
      })
      .then((r) => r.data),
  book: (slug: string, payload: BookingPayload) =>
    api.post<{ appointment: BookedAppointment; message: string }>(`/public/barbershops/${slug}/book`, payload).then((r) => r.data),
  waitlist: (slug: string, payload: WaitlistPayload) => api.post(`/public/barbershops/${slug}/waitlist`, payload).then((r) => r.data),
  survey: (token: string) => api.get<PublicSurvey>(`/public/surveys/${token}`).then((r) => r.data),
  answerSurvey: (token: string, payload: { rating: number; comment?: string }) => api.post(`/public/surveys/${token}`, payload).then((r) => r.data),
};

/** Endereço em uma linha */
export function formatAddress(a: PublicAddress | null | undefined): string {
  if (!a) return '';
  const line1 = [a.street, a.number].filter(Boolean).join(', ');
  const cityState = [a.city, a.state].filter(Boolean).join(' - ');
  return [line1, a.complement, a.district, cityState].filter(Boolean).join(' · ');
}

export function mapsLink(a: PublicAddress | null | undefined, name?: string): string | null {
  if (!a) return null;
  if (a.latitude && a.longitude) return `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`;
  if (!a.street && !a.city) return null;
  const q = [name, a.street, a.number, a.district, a.city, a.state, a.zip].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function socialLink(kind: 'instagram' | 'facebook', v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').trim();
  return kind === 'instagram' ? `https://instagram.com/${handle}` : `https://facebook.com/${handle}`;
}

/** Link "Adicionar ao Google Agenda" */
export function googleCalendarLink(opts: { title: string; start: string | Date; end: string | Date; details?: string; location?: string }): string {
  const f = (d: string | Date) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: opts.title, dates: `${f(opts.start)}/${f(opts.end)}` });
  if (opts.details) p.set('details', opts.details);
  if (opts.location) p.set('location', opts.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
