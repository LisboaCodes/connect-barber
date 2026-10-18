import { useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Clock, CreditCard, Facebook, Gift, Instagram, MapPin, MessageCircle, Package, Phone, Scissors, Sparkles, Star, User, Users, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtPhone, minutes, money, whatsappLink } from '@/lib/utils/format';
import { formatAddress, mapsLink, socialLink, type PublicBarbershop, type PublicService } from '@/lib/api/public';
import { useAuthStore } from '@/store/auth.store';
import { OpeningHoursList, PoweredBy, ShopLogo, groupServices, isOpenNow } from './shared';

/* Tema escuro premium: fundo grafite, cartões em vidro, acento vermelho (cores da marca). */

function SectionTitle({ id, icon: Icon, eyebrow, children, action }: { id?: string; icon: ComponentType<{ className?: string }>; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">
            <Icon className="h-3.5 w-3.5" /> {eyebrow}
          </div>
        )}
        <h2 id={id} className="scroll-mt-24 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}

const card = 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm';

function ServiceCard({ s, base, booking }: { s: PublicService; base: string; booking: boolean }) {
  const can = booking && s.allowOnlineBooking;
  const inner = (
    <>
      {s.imageUrl ? (
        <div className="relative h-36 w-full overflow-hidden">
          <img src={s.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-moss-950/80 to-transparent" />
          <div className="absolute bottom-2 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{money(s.price)}</div>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-white">{s.name}</div>
            {s.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{s.description}</p>}
          </div>
          {!s.imageUrl && <div className="whitespace-nowrap text-base font-bold text-white">{money(s.price)}</div>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {minutes(s.durationMinutes)}
          </span>
          {can ? (
            <span className="inline-flex items-center gap-1 font-semibold text-gold-400 transition-colors group-hover:text-gold-300">
              Agendar <ArrowRight className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="text-gray-500">Agende pelo WhatsApp</span>
          )}
        </div>
      </div>
    </>
  );
  const cls = cn('group flex flex-col overflow-hidden text-left transition-all', card, can && 'hover:-translate-y-0.5 hover:border-gold-500/50 hover:bg-white/[0.07]');
  return can ? (
    <Link to={`${base}/agendar?servico=${s.id}`} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function BarbershopSite({ shop }: { shop: PublicBarbershop }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const isLogged = useAuthStore((s) => !!s.accessToken);
  const base = `/b/${shop.slug}`;
  const booking = shop.onlineBookingEnabled;
  const address = formatAddress(shop.address);
  const maps = mapsLink(shop.address, shop.name);
  const insta = socialLink('instagram', shop.instagram);
  const face = socialLink('facebook', shop.facebook);
  const wa = shop.whatsapp || shop.phone;
  const openNow = isOpenNow(shop.openingHours);
  const groups = groupServices(shop, shop.services);
  const cheapest = shop.services.length ? Math.min(...shop.services.map((s) => Number(s.price))) : null;
  const nav = [
    { id: 'servicos', label: 'Serviços', show: shop.services.length > 0 },
    { id: 'equipe', label: 'Equipe', show: shop.professionals.length > 0 },
    { id: 'galeria', label: 'Galeria', show: shop.gallery.length > 0 },
    { id: 'pacotes', label: 'Pacotes', show: shop.packages.length > 0 },
    { id: 'informacoes', label: 'Onde estamos', show: true },
    { id: 'sobre', label: 'Sobre', show: !!shop.about },
  ].filter((n) => n.show);

  const waText = `Olá! Vim pelo site da ${shop.name}.`;

  return (
    <div className="min-h-screen bg-moss-950 text-gray-100 pb-24 sm:pb-0 selection:bg-gold-500/40">
      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to={base} className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <ShopLogo name={shop.name} logoUrl={shop.logoUrl} className="h-8 w-8 text-xs" />
            <span className="hidden sm:inline">{shop.name}</span>
          </Link>
          <Button asChild size="sm" variant="secondary" className="bg-white/10 text-white backdrop-blur hover:bg-white/20">
            <Link to={isLogged ? '/cliente' : `/cliente/login?redirect=${encodeURIComponent(base)}`}>
              <User /> {isLogged ? 'Minha área' : 'Entrar'}
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          {shop.coverUrl ? (
            <img src={shop.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_left,rgba(165,140,100,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.08),transparent_50%),#0b0b0f]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-moss-950/70 via-moss-950/60 to-moss-950" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-24 sm:px-6 sm:pb-16 sm:pt-32">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <ShopLogo name={shop.name} logoUrl={shop.logoUrl} className="h-24 w-24 shrink-0 text-3xl shadow-2xl ring-4 ring-moss-950/60 sm:h-32 sm:w-32 sm:text-4xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {openNow !== null && (
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium backdrop-blur', openNow ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border-gold-400/40 bg-gold-500/15 text-gold-300')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', openNow ? 'bg-emerald-400' : 'bg-gold-400')} />
                    {openNow ? 'Aberto agora' : 'Fechado agora'}
                  </span>
                )}
                {shop.rating && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium text-white backdrop-blur">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {shop.rating.average.toFixed(1).replace('.', ',')} <span className="text-white/60">({shop.rating.count})</span>
                  </span>
                )}
                {shop.address.city && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/80 backdrop-blur">
                    <MapPin className="h-3.5 w-3.5" />
                    {[shop.address.district, shop.address.city].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">{shop.name}</h1>
              {shop.description && <p className="mt-3 max-w-2xl text-base text-gray-300 sm:text-lg">{shop.description}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                {booking && (
                  <Button asChild size="xl" className="shadow-[0_10px_30px_-10px_rgba(165,140,100,0.7)]">
                    <Link to={`${base}/agendar`}>
                      <CalendarCheck /> Agendar agora
                    </Link>
                  </Button>
                )}
                {wa && (
                  <Button asChild size="xl" variant="secondary" className="border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                    <a href={whatsappLink(wa, waText)} target="_blank" rel="noreferrer">
                      <MessageCircle /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
                {shop.services.length > 0 && (
                  <span>
                    <strong className="text-white">{shop.services.length}</strong> serviços{cheapest !== null && cheapest > 0 ? ` · a partir de ${money(cheapest)}` : ''}
                  </span>
                )}
                {shop.professionals.length > 0 && (
                  <span>
                    <strong className="text-white">{shop.professionals.length}</strong> profissionais
                  </span>
                )}
                {booking && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-gold-400" /> Agendamento online 24h
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navegação por âncoras */}
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-moss-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 scrollbar-thin sm:px-6">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
              {n.label}
            </a>
          ))}
          {booking && (
            <Link to={`${base}/agendar`} className="ml-auto hidden whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-moss-950 sm:inline-flex">
              Agendar
            </Link>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6">
        {!booking && (
          <div className={cn(card, 'border-gold-500/30 bg-gold-500/10 p-5 text-sm text-gold-100')}>
            O agendamento online desta barbearia está indisponível no momento. Entre em contato pelos canais abaixo para marcar seu horário.
            {wa && (
              <div className="mt-3">
                <Button asChild size="sm" variant="success">
                  <a href={whatsappLink(wa, 'Olá! Gostaria de agendar um horário.')} target="_blank" rel="noreferrer">
                    <MessageCircle /> Chamar no WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Serviços */}
        {groups.length > 0 && (
          <section>
            <SectionTitle id="servicos" icon={Scissors} eyebrow="Menu de serviços">
              Escolha o seu estilo
            </SectionTitle>
            <div className="space-y-8">
              {groups.map((g) => (
                <div key={g.id}>
                  {groups.length > 1 && (
                    <h3 className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                      {g.name} <span className="h-px flex-1 bg-white/10" />
                    </h3>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.services.map((s) => (
                      <ServiceCard key={s.id} s={s} base={base} booking={booking} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Equipe */}
        {shop.professionals.length > 0 && (
          <section>
            <SectionTitle id="equipe" icon={Users} eyebrow="Nossa equipe">
              Quem vai cuidar de você
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shop.professionals.map((p) => (
                <div key={p.id} className={cn(card, 'group flex flex-col items-center p-5 text-center transition-colors hover:border-white/20')}>
                  <div className="relative">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-white/10 transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white ring-2 ring-white/10" style={{ backgroundColor: p.color ?? '#a58c64' }}>
                        {p.name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
                      </div>
                    )}
                    <span className="absolute -bottom-1 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-full blur-md" style={{ backgroundColor: p.color ?? '#a58c64', opacity: 0.6 }} />
                  </div>
                  <div className="mt-4 font-semibold text-white">{p.name}</div>
                  {p.bio && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-400">{p.bio}</p>}
                  {booking && p.acceptsOnlineBooking && (
                    <Link to={`${base}/agendar?profissional=${p.id}`} className="mt-4 inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-gold-500/60 hover:bg-gold-500/10">
                      Agendar com {p.name.split(' ')[0]} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galeria */}
        {shop.gallery.length > 0 && (
          <section>
            <SectionTitle id="galeria" icon={Instagram} eyebrow="Galeria">
              Nosso trabalho
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {shop.gallery.map((src, i) => (
                <button key={i} onClick={() => setLightbox(src)} className={cn('group relative overflow-hidden rounded-xl bg-white/5', i === 0 && 'col-span-2 row-span-2')}>
                  <img src={src} alt={`Foto ${i + 1}`} loading="lazy" className="aspect-square h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Pacotes */}
        {shop.packages.length > 0 && (
          <section>
            <SectionTitle id="pacotes" icon={Package} eyebrow="Economize">
              Pacotes e combos
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shop.packages.map((p) => (
                <div key={p.id} className={cn(card, 'relative overflow-hidden p-5')}>
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-500/20 blur-2xl" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="whitespace-nowrap text-lg font-black text-white">{money(p.price)}</div>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-gray-400">{p.description}</p>}
                  <ul className="mt-3 space-y-1 text-sm text-gray-300">
                    {p.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                        {it.quantity}× {it.service?.name ?? it.product?.name}
                      </li>
                    ))}
                  </ul>
                  {p.validityDays && <div className="mt-4 inline-block rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-gray-400">Validade de {p.validityDays} dias</div>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">Pacotes são adquiridos diretamente na barbearia.</p>
          </section>
        )}

        {/* Fidelidade */}
        {shop.loyalty && (
          <section className={cn(card, 'relative overflow-hidden border-gold-500/30 p-6 sm:p-8')}>
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold-500/25 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-500/20 text-gold-300">
                <Gift className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-white">{shop.loyalty.name}</div>
                <p className="mt-1 text-sm text-gray-300">{shop.loyalty.description || `Ganhe ${shop.loyalty.pointsPerCurrency} ponto(s) a cada R$ 1,00 e troque por prêmios.`}</p>
              </div>
              {!isLogged && (
                <Button asChild variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                  <Link to="/cliente/cadastro">Criar minha conta</Link>
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Informações */}
        <section>
          <SectionTitle id="informacoes" icon={MapPin} eyebrow="Onde estamos">
            Informações e horários
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={cn(card, 'space-y-5 p-5')}>
              {address && (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                  <div className="text-sm text-gray-200">
                    <div>{address}</div>
                    {shop.address.zip && <div className="text-gray-500">CEP {shop.address.zip}</div>}
                    {maps && (
                      <a href={maps} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
                        Como chegar <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              {shop.whatsapp && (
                <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-gray-200 hover:text-white">
                  <MessageCircle className="h-5 w-5 shrink-0 text-emerald-400" /> {fmtPhone(shop.whatsapp)} <span className="text-gray-500">WhatsApp</span>
                </a>
              )}
              {shop.phone && shop.phone !== shop.whatsapp && (
                <a href={`tel:${shop.phone.replace(/\D/g, '')}`} className="flex items-center gap-3 text-sm text-gray-200 hover:text-white">
                  <Phone className="h-5 w-5 shrink-0 text-gold-400" /> {fmtPhone(shop.phone)}
                </a>
              )}
              {shop.paymentInfo && (
                <div className="flex gap-3 text-sm">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                  <div>
                    <div className="font-medium text-gray-200">Formas de pagamento</div>
                    <p className="whitespace-pre-line text-gray-400">{shop.paymentInfo}</p>
                  </div>
                </div>
              )}
              {(insta || face) && (
                <div className="flex gap-2 pt-1">
                  {insta && (
                    <a href={insta} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                      <Instagram className="h-4 w-4" /> Instagram
                    </a>
                  )}
                  {face && (
                    <a href={face} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                      <Facebook className="h-4 w-4" /> Facebook
                    </a>
                  )}
                </div>
              )}
              {!address && !shop.whatsapp && !shop.phone && !shop.paymentInfo && !insta && !face && <p className="text-sm text-gray-500">Sem informações de contato.</p>}
            </div>
            <div className={cn(card, 'p-5')}>
              <div className="mb-2 flex items-center gap-2 font-semibold text-white">
                <Clock className="h-4 w-4 text-gold-400" /> Horário de funcionamento
              </div>
              <OpeningHoursList openingHours={shop.openingHours} dark />
            </div>
          </div>
        </section>

        {/* Sobre */}
        {shop.about && (
          <section>
            <SectionTitle id="sobre" icon={Scissors} eyebrow="Sobre nós">
              Nossa história
            </SectionTitle>
            <p className={cn(card, 'whitespace-pre-line p-6 text-base leading-relaxed text-gray-300')}>{shop.about}</p>
          </section>
        )}

        {/* CTA final */}
        {booking && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold-500 to-gold-700 p-8 text-center text-moss-950 sm:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
            <div className="relative">
              <h2 className="text-2xl font-black sm:text-3xl">Pronto para renovar o visual?</h2>
              <p className="mx-auto mt-2 max-w-md text-moss-950/80">Escolha o serviço, o profissional e o horário. Leva menos de um minuto.</p>
              <Button asChild size="xl" variant="dark" className="mt-6 bg-moss-950 text-white hover:bg-black">
                <Link to={`${base}/agendar`}>
                  <CalendarCheck /> Agendar agora
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="mb-2 text-center text-sm font-medium text-gray-300">{shop.name}</p>
          <PoweredBy className="text-gray-500" />
        </div>
      </footer>

      {/* CTA fixo no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-moss-950/90 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          {booking ? (
            <Button asChild size="lg" className="flex-1">
              <Link to={`${base}/agendar`}>
                <CalendarCheck /> Agendar agora
              </Link>
            </Button>
          ) : null}
          {wa && (
            <Button asChild size="lg" variant={booking ? 'secondary' : 'success'} className={cn(booking ? 'bg-white/10 text-white hover:bg-white/20' : 'flex-1')}>
              <a href={whatsappLink(wa, waText)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle /> {!booking && 'Chamar no WhatsApp'}
              </a>
            </Button>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
