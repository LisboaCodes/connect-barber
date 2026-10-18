import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const money = (v: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

export const num = (v: number | string | null | undefined, digits = 0) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v ?? 0));

export const pct = (v: number | null | undefined, digits = 1) => `${num(v ?? 0, digits)}%`;

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

export const fmtDate = (d: string | Date | null | undefined, pattern = 'dd/MM/yyyy') => (d ? format(toDate(d), pattern, { locale: ptBR }) : '-');
export const fmtDateTime = (d: string | Date | null | undefined) => (d ? format(toDate(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-');
export const fmtTime = (d: string | Date | null | undefined) => (d ? format(toDate(d), 'HH:mm') : '-');
export const fmtWeekday = (d: string | Date) => format(toDate(d), 'EEEE', { locale: ptBR });
export const fmtDateLong = (d: string | Date) => format(toDate(d), "EEEE, d 'de' MMMM", { locale: ptBR });
export const fmtRelative = (d: string | Date | null | undefined) => (d ? formatDistanceToNowStrict(toDate(d), { locale: ptBR, addSuffix: true }) : '-');
export const fmtDay = (d: string | Date) => {
  const date = toDate(d);
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "EEE, dd/MM", { locale: ptBR });
};
/** Date -> "yyyy-MM-dd" (local) */
export const toISODate = (d: Date = new Date()) => format(d, 'yyyy-MM-dd');
/** "yyyy-MM-dd" (date-only, sem fuso) -> Date local */
export const fromISODate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtPhone = (p: string | null | undefined) => {
  if (!p) return '-';
  const d = p.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
};

export const whatsappLink = (p: string | null | undefined, text?: string) => {
  if (!p) return '#';
  const d = p.replace(/\D/g, '');
  const n = d.startsWith('55') ? d : `55${d}`;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m} min`);

export const initials = (name: string | null | undefined) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Marcado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencida',
  WAITING: 'Aguardando',
  NOTIFIED: 'Avisado',
  BOOKED: 'Agendou',
  EXPIRED: 'Expirado',
  DRAFT: 'Rascunho',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  TRIAL: 'Teste grátis',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Em atraso',
  BLOCKED: 'Bloqueado',
};

export const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-sky-100 text-sky-800 border-sky-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  NO_SHOW: 'bg-rose-100 text-rose-800 border-rose-200',
  OPEN: 'bg-amber-100 text-amber-800 border-amber-200',
  CLOSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  OVERDUE: 'bg-red-100 text-red-800 border-red-200',
  WAITING: 'bg-sky-100 text-sky-800 border-sky-200',
  NOTIFIED: 'bg-amber-100 text-amber-800 border-amber-200',
  BOOKED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  EXPIRED: 'bg-gray-100 text-gray-700 border-gray-200',
  TRIAL: 'bg-sky-100 text-sky-800 border-sky-200',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PAST_DUE: 'bg-amber-100 text-amber-800 border-amber-200',
  BLOCKED: 'bg-red-100 text-red-800 border-red-200',
};

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  TRANSFER: 'Transferência',
  ONLINE: 'Pagamento online',
  LOYALTY_POINTS: 'Pontos de fidelidade',
  PACKAGE: 'Pacote',
  OTHER: 'Outro',
};

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Gestor',
  RECEPTION: 'Recepção',
  PROFESSIONAL: 'Profissional',
};

export const SOURCE_LABEL: Record<string, string> = {
  ADMIN: 'Barbearia',
  SITE: 'Site',
  CLIENT: 'Área do cliente',
  WAITLIST: 'Lista de espera',
  RECURRING: 'Recorrente',
};
