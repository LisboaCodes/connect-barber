import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone } from '../../common/utils';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../appointments/availability.service';
import { ClientsService } from '../clients/clients.service';
import { EngagementService } from '../engagement/engagement.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PublicBookingDto, PublicWaitlistDto } from './public.dto';

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
    private availabilityService: AvailabilityService,
    private clients: ClientsService,
    private engagement: EngagementService,
    private loyalty: LoyaltyService,
  ) {}

  private async tenantBySlug(slug: string) {
    const t = await this.prisma.tenant.findFirst({ where: { slug, deletedAt: null, isActive: true } });
    if (!t || !t.siteEnabled) throw new NotFoundException('Barbearia não encontrada');
    return t;
  }

  /** Dados do site público da barbearia */
  async site(slug: string) {
    const t = await this.tenantBySlug(slug);
    const [professionals, services, categories, packages, program, reviews] = await Promise.all([
      this.prisma.professional.findMany({ where: { tenantId: t.id, isActive: true, deletedAt: null, showOnSite: true }, select: { id: true, name: true, avatarUrl: true, bio: true, color: true, acceptsOnlineBooking: true, services: { select: { serviceId: true } } }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.service.findMany({ where: { tenantId: t.id, isActive: true, deletedAt: null }, select: { id: true, name: true, description: true, durationMinutes: true, price: true, categoryId: true, imageUrl: true, allowOnlineBooking: true, professionals: { select: { professionalId: true } } }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.serviceCategory.findMany({ where: { tenantId: t.id }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.package.findMany({ where: { tenantId: t.id, isActive: true, sellOnline: true }, include: { items: { include: { service: { select: { name: true } }, product: { select: { name: true } } } } } }),
      this.prisma.loyaltyProgram.findUnique({ where: { tenantId: t.id }, select: { isActive: true, name: true, description: true, pointsPerCurrency: true } }),
      this.prisma.satisfactionSurvey.aggregate({ where: { tenantId: t.id, rating: { not: null } }, _avg: { rating: true }, _count: true }),
    ]);
    const blocked = t.planStatus === 'BLOCKED' || t.planStatus === 'CANCELLED' || (t.planStatus === 'TRIAL' && !!t.trialEndsAt && t.trialEndsAt < new Date());
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      about: t.siteAbout,
      logoUrl: t.logoUrl,
      coverUrl: t.coverUrl,
      gallery: t.siteGallery ?? [],
      phone: t.phone,
      whatsapp: t.whatsapp,
      email: t.email,
      instagram: t.siteInstagram,
      facebook: t.siteFacebook,
      paymentInfo: t.sitePaymentInfo,
      address: { street: t.addressStreet, number: t.addressNumber, complement: t.addressComplement, district: t.addressDistrict, city: t.addressCity, state: t.addressState, zip: t.addressZip, latitude: t.latitude, longitude: t.longitude },
      openingHours: t.openingHours,
      timezone: t.timezone,
      onlineBookingEnabled: t.onlineBookingEnabled && !blocked,
      cancelLimitHours: t.cancelLimitHours,
      minAdvanceMin: t.minAdvanceMin,
      maxAdvanceDays: t.maxAdvanceDays,
      professionals,
      services,
      categories,
      packages,
      loyalty: program?.isActive ? program : null,
      rating: reviews._count ? { average: Math.round((reviews._avg.rating ?? 0) * 10) / 10, count: reviews._count } : null,
    };
  }

  async availability(slug: string, q: { date: string; professionalId?: string; serviceIds?: string }) {
    const t = await this.tenantBySlug(slug);
    if (!t.onlineBookingEnabled) throw new ForbiddenException('Agendamento online desativado');
    const serviceIds = (q.serviceIds ?? '').split(',').filter(Boolean);
    if (!serviceIds.length) throw new BadRequestException('Selecione ao menos um serviço');
    const services = await this.prisma.service.findMany({ where: { tenantId: t.id, id: { in: serviceIds }, isActive: true, allowOnlineBooking: true } });
    if (services.length !== serviceIds.length) throw new BadRequestException('Serviço indisponível para agendamento online');
    const duration = services.reduce((s, x) => s + x.durationMinutes, 0);
    const list = await this.availabilityService.forDate(t, q.date, duration, { professionalId: q.professionalId, serviceIds, onlineRules: true });
    return list.map((a) => ({ professionalId: a.professionalId, professionalName: a.professionalName, color: a.color, off: a.off, slots: a.slots }));
  }

  async book(slug: string, user: AuthUser | undefined, dto: PublicBookingDto) {
    const t = await this.tenantBySlug(slug);
    if (!t.onlineBookingEnabled) throw new ForbiddenException('Agendamento online desativado');
    let clientId: string | undefined;
    let clientName = dto.name;
    let clientPhone = dto.phone;
    let clientEmail = dto.email;
    if (user) {
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
      const c = await this.clients.findOrCreateByPhone(t.id, { name: u.name, phone: dto.phone ?? u.phone, email: u.email, userId: u.id }, 'CLIENT');
      clientId = c.id;
    } else {
      if (!clientName || !clientPhone) throw new BadRequestException('Informe nome e telefone');
      const c = await this.clients.findOrCreateByPhone(t.id, { name: clientName, phone: clientPhone, email: clientEmail }, 'SITE');
      clientId = c.id;
    }
    const r = await this.appointments.create(t.id, null, { professionalId: dto.professionalId, clientId, serviceIds: dto.serviceIds, date: dto.date, time: dto.time, notes: dto.notes }, user ? 'CLIENT' : 'SITE');
    return { appointment: this.publicAppointment(r.appointment), message: t.autoConfirm ? 'Agendamento confirmado!' : 'Agendamento recebido. Aguarde a confirmação da barbearia.' };
  }

  async joinWaitlist(slug: string, user: AuthUser | undefined, dto: PublicWaitlistDto) {
    const t = await this.tenantBySlug(slug);
    let clientId: string | undefined;
    if (user) {
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
      clientId = (await this.clients.findOrCreateByPhone(t.id, { name: u.name, phone: dto.phone ?? u.phone, email: u.email, userId: u.id }, 'CLIENT')).id;
    } else if (!dto.name || !dto.phone) throw new BadRequestException('Informe nome e telefone');
    return this.engagement.addToWaitlist(t.id, { clientId, clientName: dto.name, clientPhone: dto.phone, date: dto.date, professionalId: dto.professionalId, serviceId: dto.serviceId, periodStart: dto.periodStart, periodEnd: dto.periodEnd }, 'SITE');
  }

  // ---------------- área do cliente (logado) ----------------
  async myAppointments(user: AuthUser) {
    const clients = await this.myClients(user);
    const ids = clients.map((c) => c.id);
    const list = await this.prisma.appointment.findMany({
      where: { clientId: { in: ids }, deletedAt: null },
      include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true, cancelLimitHours: true, addressStreet: true, addressNumber: true, addressDistrict: true, addressCity: true, phone: true, whatsapp: true } }, professional: { select: { id: true, name: true, avatarUrl: true } }, services: { include: { service: { select: { name: true } } } } },
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return list.map((a) => this.publicAppointment(a));
  }

  async cancelMyAppointment(user: AuthUser, id: string) {
    const clients = await this.myClients(user);
    const a = await this.prisma.appointment.findFirst({ where: { id, clientId: { in: clients.map((c) => c.id) } } });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    return this.appointments.changeStatus(a.tenantId, null, id, { status: 'CANCELLED', reason: 'Cancelado pelo cliente' }, 'CLIENT');
  }

  async myProfile(user: AuthUser) {
    const clients = await this.prisma.client.findMany({
      where: { userId: user.sub, deletedAt: null },
      include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true } }, club: { select: { name: true, discountPct: true } }, packages: { where: { isActive: true }, include: { package: { select: { name: true } }, items: { include: { service: { select: { name: true } }, product: { select: { name: true } } } } } } },
    });
    const programs = await this.prisma.loyaltyProgram.findMany({ where: { tenantId: { in: clients.map((c) => c.tenantId) }, isActive: true }, include: { rewards: { where: { isActive: true }, orderBy: { pointsCost: 'asc' } } } });
    return clients.map((c) => ({
      clientId: c.id,
      tenant: c.tenant,
      loyaltyPoints: c.loyaltyPoints,
      visitsCount: c.visitsCount,
      lastVisitAt: c.lastVisitAt,
      club: c.club,
      packages: c.packages,
      program: programs.find((p) => p.tenantId === c.tenantId) ?? null,
    }));
  }

  async myLoyalty(user: AuthUser, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, userId: user.sub } });
    if (!client) throw new NotFoundException('Cadastro não encontrado');
    const [program, transactions] = await Promise.all([
      this.prisma.loyaltyProgram.findUnique({ where: { tenantId: client.tenantId }, include: { rewards: { where: { isActive: true }, orderBy: { pointsCost: 'asc' } } } }),
      this.prisma.loyaltyTransaction.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 50, include: { reward: { select: { name: true } } } }),
    ]);
    return { points: client.loyaltyPoints, program, transactions };
  }

  async requestRedeem(user: AuthUser, clientId: string, rewardId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, userId: user.sub } });
    if (!client) throw new NotFoundException('Cadastro não encontrado');
    return this.loyalty.redeem(client.tenantId, clientId, rewardId, true);
  }

  async updateMyPhone(user: AuthUser, phone: string) {
    const p = normalizePhone(phone);
    await this.prisma.user.update({ where: { id: user.sub }, data: { phone: p } });
    await this.prisma.client.updateMany({ where: { userId: user.sub, phone: null }, data: { phone: p } });
    return { ok: true };
  }

  private async myClients(user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    // vincula cadastros ainda não ligados ao usuário (mesmo telefone/e-mail)
    await this.prisma.client.updateMany({ where: { userId: null, OR: [{ email: u.email }, ...(u.phone ? [{ phone: u.phone }] : [])] }, data: { userId: u.id } });
    return this.prisma.client.findMany({ where: { userId: u.id, deletedAt: null }, select: { id: true, tenantId: true } });
  }

  private publicAppointment(a: any) {
    return {
      id: a.id,
      tenant: a.tenant,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
      professional: a.professional,
      services: (a.services ?? []).map((s: any) => ({ name: s.service?.name, price: Number(s.price), durationMinutes: s.durationMinutes })),
      totalPrice: Number(a.totalPrice),
      totalDuration: a.totalDuration,
      notes: a.notes,
      cancelReason: a.cancelReason,
    };
  }
}
