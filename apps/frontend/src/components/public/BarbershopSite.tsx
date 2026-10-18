import { useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, CreditCard, Facebook, Gift, Instagram, MapPin, MessageCircle, Package, Phone, Scissors, User, X } from 'lucide-react';
import { Avatar, Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtPhone, minutes, money, whatsappLink } from '@/lib/utils/format';
import { formatAddress, mapsLink, socialLink, type PublicBarbershop } from '@/lib/api/public';
import { useAuthStore } from '@/store/auth.store';
import { OpeningHoursList, PoweredBy, RatingStars, ShopLogo, groupServices, isOpenNow } from './shared';

function SectionTitle({ id, icon: Icon, children }: { id?: string; icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-4 flex scroll-mt-20 items-center gap-2 text-lg font-bold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-amber-700">
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
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
  const nav = [
    { id: 'servicos', label: 'Serviços', show: shop.services.length > 0 },
    { id: 'profissionais', label: 'Equipe', show: shop.professionals.length > 0 },
    { id: 'informacoes', label: 'Informações', show: true },
    { id: 'galeria', label: 'Galeria', show: shop.gallery.length > 0 },
    { id: 'pacotes', label: 'Pacotes', show: shop.packages.length > 0 },
    { id: 'sobre', label: 'Sobre', show: !!shop.about },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-0">
      {/* Capa */}
      <header className="relative">
        <div className="relative h-48 w-full overflow-hidden bg-gray-900 sm:h-64">
          {shop.coverUrl ? (
            <img src={shop.coverUrl} alt="" className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.45),transparent_55%),linear-gradient(135deg,#111827,#1f2937)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-gray-950/20 to-transparent" />
          <div className="absolute right-3 top-3">
            <Button asChild size="sm" variant="secondary" className="bg-white/90 backdrop-blur">
              <Link to={isLogged ? '/cliente' : `/cliente/login?redirect=${encodeURIComponent(base)}`}>
                <User /> {isLogged ? 'Minha área' : 'Entrar'}
              </Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-12 flex flex-col items-start gap-3 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
            <ShopLogo name={shop.name} logoUrl={shop.logoUrl} className="relative h-24 w-24 border-4 border-white text-2xl shadow-lg sm:h-28 sm:w-28" />
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">{shop.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {shop.rating && (
                  <span className="inline-flex items-center gap-1.5">
                    <RatingStars value={shop.rating.average} />
                    <span className="font-semibold text-gray-900">{shop.rating.average.toFixed(1).replace('.', ',')}</span>
                    <span>({shop.rating.count} avaliações)</span>
                  </span>
                )}
                {openNow !== null && (
                  <span className={cn('inline-flex items-center gap-1 font-medium', openNow ? 'text-emerald-600' : 'text-red-600')}>
                    <span className={cn('h-2 w-2 rounded-full', openNow ? 'bg-emerald-500' : 'bg-red-500')} />
                    {openNow ? 'Aberto agora' : 'Fechado agora'}
                  </span>
                )}
                {shop.address.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[shop.address.district, shop.address.city].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {shop.description && <p className="mt-4 text-sm text-gray-600">{shop.description}</p>}
          <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
            {booking && (
              <Button asChild size="lg">
                <Link to={`${base}/agendar`}>
                  <CalendarCheck /> Agendar agora
                </Link>
              </Button>
            )}
            {wa && (
              <Button asChild size="lg" variant="outline">
                <a href={whatsappLink(wa, `Olá! Vim pelo site da ${shop.name}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Navegação por âncoras */}
      <nav className="sticky top-0 z-20 mt-5 border-b bg-gray-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2 scrollbar-thin">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900">
              {n.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        {!booking && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
            <SectionTitle id="servicos" icon={Scissors}>
              Serviços
            </SectionTitle>
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.id}>
                  {groups.length > 1 && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</h3>}
                  <ul className="divide-y overflow-hidden rounded-xl border bg-white">
                    {g.services.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 p-4">
                        {s.imageUrl && <img src={s.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900">{s.name}</div>
                          {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            <span className="font-semibold text-gray-900">{money(s.price)}</span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> {minutes(s.durationMinutes)}
                            </span>
                          </div>
                        </div>
                        {booking && s.allowOnlineBooking && (
                          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50">
                            <Link to={`${base}/agendar?servico=${s.id}`}>Agendar</Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Profissionais */}
        {shop.professionals.length > 0 && (
          <section>
            <SectionTitle id="profissionais" icon={User}>
              Nossa equipe
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shop.professionals.map((p) => (
                <div key={p.id} className="flex flex-col items-center rounded-xl border bg-white p-4 text-center">
                  <Avatar src={p.avatarUrl} name={p.name} color={p.color ?? '#d97706'} size="xl" />
                  <div className="mt-3 font-semibold">{p.name}</div>
                  {p.bio && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{p.bio}</p>}
                  {booking && p.acceptsOnlineBooking && (
                    <Link to={`${base}/agendar?profissional=${p.id}`} className="mt-3 text-sm font-medium text-amber-700 hover:underline">
                      Agendar com {p.name.split(' ')[0]}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Informações */}
        <section>
          <SectionTitle id="informacoes" icon={MapPin}>
            Informações
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-xl border bg-white p-4">
              {address && (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <div>{address}</div>
                    {shop.address.zip && <div className="text-muted-foreground">CEP {shop.address.zip}</div>}
                    {maps && (
                      <a href={maps} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium text-amber-700 hover:underline">
                        Ver no Google Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
              {shop.whatsapp && (
                <a href={whatsappLink(shop.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm hover:text-amber-700">
                  <MessageCircle className="h-5 w-5 shrink-0 text-emerald-600" /> {fmtPhone(shop.whatsapp)} <span className="text-muted-foreground">(WhatsApp)</span>
                </a>
              )}
              {shop.phone && (
                <a href={`tel:${shop.phone.replace(/\D/g, '')}`} className="flex items-center gap-3 text-sm hover:text-amber-700">
                  <Phone className="h-5 w-5 shrink-0 text-amber-600" /> {fmtPhone(shop.phone)}
                </a>
              )}
              {shop.paymentInfo && (
                <div className="flex gap-3 text-sm">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-medium">Formas de pagamento</div>
                    <p className="whitespace-pre-line text-muted-foreground">{shop.paymentInfo}</p>
                  </div>
                </div>
              )}
              {(insta || face) && (
                <div className="flex gap-2 pt-1">
                  {insta && (
                    <Button asChild size="sm" variant="outline">
                      <a href={insta} target="_blank" rel="noreferrer">
                        <Instagram /> Instagram
                      </a>
                    </Button>
                  )}
                  {face && (
                    <Button asChild size="sm" variant="outline">
                      <a href={face} target="_blank" rel="noreferrer">
                        <Facebook /> Facebook
                      </a>
                    </Button>
                  )}
                </div>
              )}
              {!address && !shop.whatsapp && !shop.phone && !shop.paymentInfo && !insta && !face && <p className="text-sm text-muted-foreground">Sem informações de contato.</p>}
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-amber-600" /> Horário de funcionamento
              </div>
              <OpeningHoursList openingHours={shop.openingHours} />
            </div>
          </div>
        </section>

        {/* Galeria */}
        {shop.gallery.length > 0 && (
          <section>
            <SectionTitle id="galeria" icon={Instagram}>
              Galeria
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {shop.gallery.map((src, i) => (
                <button key={i} onClick={() => setLightbox(src)} className="group aspect-square overflow-hidden rounded-lg bg-gray-200">
                  <img src={src} alt={`Foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Pacotes */}
        {shop.packages.length > 0 && (
          <section>
            <SectionTitle id="pacotes" icon={Package}>
              Pacotes
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {shop.packages.map((p) => (
                <div key={p.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{p.name}</div>
                    <div className="whitespace-nowrap font-bold text-amber-700">{money(p.price)}</div>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {p.items.map((it) => (
                      <li key={it.id}>
                        {it.quantity}× {it.service?.name ?? it.product?.name}
                      </li>
                    ))}
                  </ul>
                  {p.validityDays && <Badge variant="secondary" className="mt-3">Validade: {p.validityDays} dias</Badge>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Pacotes são adquiridos diretamente na barbearia.</p>
          </section>
        )}

        {/* Fidelidade */}
        {shop.loyalty && (
          <section className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <div className="flex items-start gap-3">
              <Gift className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">{shop.loyalty.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shop.loyalty.description || `Ganhe ${shop.loyalty.pointsPerCurrency} ponto(s) a cada R$ 1,00 e troque por prêmios.`}
                </p>
                {!isLogged && (
                  <Link to="/cliente/cadastro" className="mt-2 inline-block text-sm font-medium text-amber-700 hover:underline">
                    Crie sua conta para acompanhar seus pontos
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Sobre */}
        {shop.about && (
          <section>
            <SectionTitle id="sobre" icon={Scissors}>
              Sobre nós
            </SectionTitle>
            <p className="whitespace-pre-line rounded-xl border bg-white p-4 text-sm leading-relaxed text-gray-700">{shop.about}</p>
          </section>
        )}
      </main>

      <footer className="border-t bg-white py-6">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-2 text-center text-sm font-medium">{shop.name}</p>
          <PoweredBy />
        </div>
      </footer>

      {/* CTA fixo no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          {booking ? (
            <Button asChild size="lg" className="flex-1">
              <Link to={`${base}/agendar`}>
                <CalendarCheck /> Agendar agora
              </Link>
            </Button>
          ) : null}
          {wa && (
            <Button asChild size="lg" variant={booking ? 'outline' : 'success'} className={booking ? '' : 'flex-1'}>
              <a href={whatsappLink(wa, `Olá! Vim pelo site da ${shop.name}.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle /> {!booking && 'Chamar no WhatsApp'}
              </a>
            </Button>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
