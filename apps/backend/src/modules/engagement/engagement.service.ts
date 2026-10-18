import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Tenant } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { money, parseDateOnly, randomToken } from '../../common/utils';
import { ClientsService } from '../clients/clients.service';
import { MessagingService, renderTemplate } from '../messaging/messaging.service';
import { CampaignDto, ReturnRuleDto, SurveyAnswerDto, WaitlistDto } from './engagement.dto';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(private prisma: PrismaService, private messaging: MessagingService, private clients: ClientsService) {}

  // =============== CAMPANHAS (notícias e promoções) ===============
  listCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async getCampaign(tenantId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: { recipients: { include: { client: { select: { id: true, name: true, phone: true, email: true } } }, orderBy: { sentAt: 'desc' } } },
    });
    if (!c) throw new NotFoundException('Campanha não encontrada');
    return c;
  }

  async createCampaign(tenantId: string, actor: AuthUser, dto: CampaignDto) {
    const audience = dto.audience ?? { all: true };
    const count = (await this.resolveAudience(tenantId, audience)).length;
    return this.prisma.campaign.create({
      data: { tenantId, title: dto.title, content: dto.content, channels: dto.channels, audience, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT', totalRecipients: count, createdById: actor.sub },
    });
  }

  async updateCampaign(tenantId: string, id: string, dto: CampaignDto) {
    const c = await this.getCampaign(tenantId, id);
    if (c.status === 'SENT' || c.status === 'SENDING') throw new BadRequestException('Campanha já enviada');
    const audience = dto.audience ?? { all: true };
    const count = (await this.resolveAudience(tenantId, audience)).length;
    return this.prisma.campaign.update({
      where: { id },
      data: { title: dto.title, content: dto.content, channels: dto.channels, audience, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT', totalRecipients: count },
    });
  }

  async previewAudience(tenantId: string, audience: Record<string, any>) {
    const list = await this.resolveAudience(tenantId, audience ?? { all: true });
    return { count: list.length, sample: list.slice(0, 20).map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })) };
  }

  async resolveAudience(tenantId: string, audience: Record<string, any>) {
    const where: Prisma.ClientWhereInput = { tenantId, deletedAt: null, blocked: false, marketingOptIn: true };
    if (audience.tags?.length) where.tags = { hasSome: audience.tags };
    if (audience.clubId) where.clubId = audience.clubId;
    if (audience.professionalId) where.preferredProfessionalId = audience.professionalId;
    if (audience.inactiveDays) {
      const d = new Date(Date.now() - Number(audience.inactiveDays) * 86400000);
      where.OR = [{ lastVisitAt: { lt: d } }, { lastVisitAt: null }];
    }
    if (audience.minVisits) where.visitsCount = { gte: Number(audience.minVisits) };
    let clients = await this.prisma.client.findMany({ where, select: { id: true, name: true, phone: true, email: true, birthDate: true } });
    if (audience.birthdayMonth) clients = clients.filter((c) => c.birthDate && c.birthDate.getUTCMonth() + 1 === Number(audience.birthdayMonth));
    if (audience.clientIds?.length) clients = clients.filter((c) => audience.clientIds.includes(c.id));
    return clients.filter((c) => c.phone || c.email);
  }

  async sendCampaign(tenantId: string, id: string) {
    const c = await this.getCampaign(tenantId, id);
    if (c.status === 'SENT' || c.status === 'SENDING') throw new BadRequestException('Campanha já enviada');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await this.prisma.campaign.update({ where: { id }, data: { status: 'SENDING' } });
    const audience = await this.resolveAudience(tenantId, (c.audience as any) ?? { all: true });
    let sent = 0;
    for (const client of audience) {
      const text = renderTemplate(c.content, { cliente: client.name.split(' ')[0], barbearia: tenant.name, link: `${this.messaging.appUrl()}/b/${tenant.slug}` });
      const results = await this.messaging.send({ tenantId, clientId: client.id, kind: 'CAMPAIGN', channels: c.channels, phone: client.phone, email: client.email, subject: `${c.title} - ${tenant.name}`, text, campaignId: id });
      const ok = results.some((r) => r.ok);
      if (ok) sent++;
      await this.prisma.campaignRecipient.upsert({
        where: { campaignId_clientId: { campaignId: id, clientId: client.id } },
        update: { sentAt: ok ? new Date() : null, error: ok ? null : results.map((r) => r.error).filter(Boolean).join('; ') || 'sem canal disponível' },
        create: { campaignId: id, clientId: client.id, sentAt: ok ? new Date() : null, error: ok ? null : results.map((r) => r.error).filter(Boolean).join('; ') || 'sem canal disponível' },
      });
    }
    return this.prisma.campaign.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), totalRecipients: audience.length, totalSent: sent } });
  }

  async cancelCampaign(tenantId: string, id: string) {
    const c = await this.getCampaign(tenantId, id);
    if (c.status === 'SENT') throw new BadRequestException('Campanha já enviada');
    return this.prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async deleteCampaign(tenantId: string, id: string) {
    await this.getCampaign(tenantId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  /** Marca leitura (pixel/link de rastreio) */
  async trackRead(campaignId: string, clientId: string) {
    const r = await this.prisma.campaignRecipient.findUnique({ where: { campaignId_clientId: { campaignId, clientId } } });
    if (r && !r.readAt) {
      await this.prisma.campaignRecipient.update({ where: { id: r.id }, data: { readAt: new Date() } });
      await this.prisma.campaign.update({ where: { id: campaignId }, data: { totalRead: { increment: 1 } } });
    }
  }

  // =============== LISTA DE ESPERA ===============
  listWaitlist(tenantId: string, q: { date?: string; from?: string; status?: string }) {
    return this.prisma.waitlistEntry.findMany({
      where: {
        tenantId,
        ...(q.date ? { date: parseDateOnly(q.date) } : q.from ? { date: { gte: parseDateOnly(q.from) } } : { date: { gte: parseDateOnly(new Date().toISOString().slice(0, 10)) } }),
        ...(q.status ? { status: q.status as any } : {}),
      },
      include: { client: { select: { id: true, name: true, phone: true, email: true } }, professional: { select: { id: true, name: true } }, service: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addToWaitlist(tenantId: string, dto: WaitlistDto, source = 'ADMIN') {
    let clientId = dto.clientId;
    if (!clientId) {
      if (!dto.clientName) throw new BadRequestException('Informe o cliente');
      const c = await this.clients.findOrCreateByPhone(tenantId, { name: dto.clientName, phone: dto.clientPhone }, source);
      clientId = c.id;
    }
    const existing = await this.prisma.waitlistEntry.findFirst({ where: { tenantId, clientId, date: parseDateOnly(dto.date), status: { in: ['WAITING', 'NOTIFIED'] } } });
    if (existing) return existing;
    return this.prisma.waitlistEntry.create({
      data: { tenantId, clientId, date: parseDateOnly(dto.date), professionalId: dto.professionalId ?? null, serviceId: dto.serviceId ?? null, periodStart: dto.periodStart, periodEnd: dto.periodEnd, notes: dto.notes },
    });
  }

  async updateWaitlistStatus(tenantId: string, id: string, status: 'WAITING' | 'NOTIFIED' | 'BOOKED' | 'CANCELLED') {
    const e = await this.prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Registro não encontrado');
    return this.prisma.waitlistEntry.update({ where: { id }, data: { status, notifiedAt: status === 'NOTIFIED' ? new Date() : undefined } });
  }

  async notifyWaitlistEntry(tenantId: string, id: string, customText?: string) {
    const e = await this.prisma.waitlistEntry.findFirst({ where: { id, tenantId }, include: { client: true } });
    if (!e) throw new NotFoundException('Registro não encontrado');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const text = customText || `Olá ${e.client.name.split(' ')[0]}! Vagou um horário na ${tenant.name} para ${e.date.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/')}. Agende agora: ${this.messaging.appUrl()}/b/${tenant.slug}`;
    await this.messaging.send({ tenantId, clientId: e.clientId, kind: 'WAITLIST', channels: ['WHATSAPP', 'EMAIL'], phone: e.client.phone, email: e.client.email, subject: `Vagou um horário - ${tenant.name}`, text });
    return this.prisma.waitlistEntry.update({ where: { id }, data: { status: 'NOTIFIED', notifiedAt: new Date() } });
  }

  // =============== MENSAGENS DE RETORNO ===============
  listReturnRules(tenantId: string) {
    return this.prisma.returnRule.findMany({ where: { tenantId }, include: { service: { select: { id: true, name: true } } }, orderBy: { daysAfter: 'asc' } });
  }
  createReturnRule(tenantId: string, dto: ReturnRuleDto) {
    return this.prisma.returnRule.create({ data: { tenantId, serviceId: dto.serviceId ?? null, daysAfter: dto.daysAfter, message: dto.message, channels: dto.channels ?? ['WHATSAPP'], isActive: dto.isActive ?? true } });
  }
  async updateReturnRule(tenantId: string, id: string, dto: ReturnRuleDto) {
    const r = await this.prisma.returnRule.findFirst({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Regra não encontrada');
    return this.prisma.returnRule.update({ where: { id }, data: { serviceId: dto.serviceId ?? null, daysAfter: dto.daysAfter, message: dto.message, channels: dto.channels, isActive: dto.isActive } });
  }
  async removeReturnRule(tenantId: string, id: string) {
    await this.prisma.returnRule.deleteMany({ where: { id, tenantId } });
    return { ok: true };
  }

  // =============== PESQUISA DE SATISFAÇÃO ===============
  async listSurveys(tenantId: string, q: { from?: string; to?: string; professionalId?: string; answered?: string }) {
    const where: Prisma.SatisfactionSurveyWhereInput = {
      tenantId,
      ...(q.professionalId ? { professionalId: q.professionalId } : {}),
      ...(q.answered === 'true' ? { answeredAt: { not: null } } : q.answered === 'false' ? { answeredAt: null } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to + 'T23:59:59.999Z') } : {}) } } : {}),
    };
    const [items, stats] = await Promise.all([
      this.prisma.satisfactionSurvey.findMany({ where, include: { client: { select: { id: true, name: true } }, professional: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.satisfactionSurvey.groupBy({ by: ['professionalId'], where: { ...where, rating: { not: null } }, _avg: { rating: true }, _count: true }),
    ]);
    const answered = items.filter((i) => i.rating !== null);
    const avg = answered.length ? money(answered.reduce((s, i) => s + (i.rating ?? 0), 0) / answered.length) : null;
    const distribution = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: answered.filter((i) => i.rating === r).length }));
    return { items, summary: { sent: items.length, answered: answered.length, average: avg, distribution, byProfessional: stats.map((s) => ({ professionalId: s.professionalId, average: s._avg.rating ? money(s._avg.rating) : null, count: s._count })) } };
  }

  async createSurveyFor(tenant: Tenant, appointment: { id: string; clientId: string | null; professionalId: string; orderId: string | null; client?: { name: string; phone: string | null; email: string | null } | null }) {
    if (!appointment.clientId) return null;
    const existing = await this.prisma.satisfactionSurvey.findUnique({ where: { appointmentId: appointment.id } });
    if (existing) return existing;
    const client = appointment.client ?? (await this.prisma.client.findUnique({ where: { id: appointment.clientId } }));
    if (!client) return null;
    const survey = await this.prisma.satisfactionSurvey.create({
      data: { tenantId: tenant.id, clientId: appointment.clientId, professionalId: appointment.professionalId, appointmentId: appointment.id, orderId: appointment.orderId, token: randomToken(24) },
    });
    const link = `${this.messaging.appUrl()}/avaliar/${survey.token}`;
    const text = `Olá ${client.name.split(' ')[0]}! Como foi seu atendimento na ${tenant.name}? Avalie em 10 segundos: ${link}`;
    await this.messaging.send({ tenantId: tenant.id, clientId: appointment.clientId, kind: 'SURVEY', channels: ((tenant.reminderChannels as any) ?? ['WHATSAPP']) as any, phone: client.phone, email: client.email, subject: `Como foi seu atendimento? - ${tenant.name}`, text, appointmentId: appointment.id });
    await this.prisma.satisfactionSurvey.update({ where: { id: survey.id }, data: { sentAt: new Date() } });
    return survey;
  }

  async getSurveyByToken(token: string) {
    const s = await this.prisma.satisfactionSurvey.findUnique({ where: { token }, include: { tenant: { select: { name: true, logoUrl: true, slug: true } }, professional: { select: { name: true } }, appointment: { select: { startAt: true, services: { include: { service: { select: { name: true } } } } } } } });
    if (!s) throw new NotFoundException('Pesquisa não encontrada');
    return s;
  }

  async answerSurvey(token: string, dto: SurveyAnswerDto) {
    const s = await this.prisma.satisfactionSurvey.findUnique({ where: { token } });
    if (!s) throw new NotFoundException('Pesquisa não encontrada');
    if (s.answeredAt) throw new BadRequestException('Pesquisa já respondida');
    return this.prisma.satisfactionSurvey.update({ where: { id: s.id }, data: { rating: dto.rating, comment: dto.comment, answeredAt: new Date() } });
  }

  // =============== LOGS ===============
  messageLogs(tenantId: string, q: { kind?: string; status?: string; clientId?: string; page?: string; limit?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Number(q.limit) || 50);
    const where: Prisma.MessageLogWhereInput = { tenantId, ...(q.kind ? { kind: q.kind as any } : {}), ...(q.status ? { status: q.status as any } : {}), ...(q.clientId ? { clientId: q.clientId } : {}) };
    return Promise.all([
      this.prisma.messageLog.findMany({ where, include: { client: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.messageLog.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, limit, pages: Math.ceil(total / limit), providers: this.messaging.status }));
  }
}
