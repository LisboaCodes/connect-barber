import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { WEEKDAYS } from '@/lib/utils/format';
import type { PublicBarbershop, PublicProfessional, PublicService, TimeRange } from '@/lib/api/public';

/** Profissional executa todos os serviços? (sem serviços cadastrados = executa todos, como no backend) */
export function professionalDoes(p: PublicProfessional, serviceIds: string[]): boolean {
  if (!p.services?.length) return true;
  const set = new Set(p.services.map((s) => s.serviceId));
  return serviceIds.every((id) => set.has(id));
}

export function bookableServices(shop: PublicBarbershop): PublicService[] {
  return shop.services.filter((s) => s.allowOnlineBooking);
}

export function bookableProfessionals(shop: PublicBarbershop, serviceIds: string[]): PublicProfessional[] {
  return shop.professionals.filter((p) => p.acceptsOnlineBooking && professionalDoes(p, serviceIds));
}

/** Agrupa serviços por categoria (na ordem das categorias; sem categoria por último) */
export function groupServices(shop: PublicBarbershop, services: PublicService[]) {
  const groups: { id: string; name: string; services: PublicService[] }[] = [];
  for (const c of shop.categories) {
    const list = services.filter((s) => s.categoryId === c.id);
    if (list.length) groups.push({ id: c.id, name: c.name, services: list });
  }
  const known = new Set(shop.categories.map((c) => c.id));
  const others = services.filter((s) => !s.categoryId || !known.has(s.categoryId));
  if (others.length) groups.push({ id: '_others', name: groups.length ? 'Outros serviços' : 'Serviços', services: others });
  return groups;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Faixas do dia (null = sem restrição cadastrada; [] = fechado) */
export function dayRanges(openingHours: PublicBarbershop['openingHours'], weekday: number): TimeRange[] | null {
  if (!openingHours) return null;
  const r = openingHours[String(weekday)];
  return Array.isArray(r) ? r : null;
}

export function isClosedDay(openingHours: PublicBarbershop['openingHours'], weekday: number): boolean {
  const r = dayRanges(openingHours, weekday);
  return r !== null && r.length === 0;
}

export function isOpenNow(openingHours: PublicBarbershop['openingHours']): boolean | null {
  if (!openingHours) return null;
  const now = new Date();
  const r = dayRanges(openingHours, now.getDay());
  if (r === null) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  return r.some((x) => m >= toMin(x.start) && m < toMin(x.end));
}

export function OpeningHoursList({ openingHours, className, dark }: { openingHours: PublicBarbershop['openingHours']; className?: string; dark?: boolean }) {
  if (!openingHours) return <p className={cn('text-sm', dark ? 'text-gray-500' : 'text-muted-foreground')}>Horários não informados.</p>;
  const today = new Date().getDay();
  // Segunda primeiro
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ul className={cn('divide-y text-sm', dark ? 'divide-white/10 text-gray-300' : '', className)}>
      {order.map((wd) => {
        const r = dayRanges(openingHours, wd);
        const isToday = wd === today;
        return (
          <li key={wd} className={cn('flex items-center justify-between py-2', isToday && (dark ? 'font-semibold text-white' : 'font-semibold'))}>
            <span className="flex items-center gap-2">
              {WEEKDAYS[wd]}
              {isToday && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase', dark ? 'bg-red-500/20 text-red-300' : 'bg-accent text-red-800')}>hoje</span>}
            </span>
            <span className={cn(!r?.length && (dark ? 'text-gray-500' : 'text-muted-foreground'))}>{r === null ? '—' : r.length ? r.map((x) => `${x.start} – ${x.end}`).join(' · ') : 'Fechado'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function RatingStars({ value, size = 'sm', className }: { value: number; size?: 'sm' | 'md'; className?: string }) {
  const s = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(s, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300')} />
      ))}
    </span>
  );
}

/** Logo da barbearia ou iniciais */
export function ShopLogo({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return logoUrl ? (
    <img src={logoUrl} alt={name} className={cn('rounded-2xl bg-white object-cover', className)} />
  ) : (
    <div className={cn('flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 font-bold text-white', className)}>{initials}</div>
  );
}

export function PoweredBy({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-xs text-muted-foreground', className)}>
      Site criado com{' '}
      <a href="/" className="font-semibold text-red-600 hover:underline">
        Connect Barber
      </a>
    </p>
  );
}
