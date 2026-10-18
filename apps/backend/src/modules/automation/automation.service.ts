import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { BillingService } from '../billing/billing.service';
import { EngagementService } from '../engagement/engagement.service';
import { MessagingService, renderTemplate } from '../messaging/messaging.service';

/**
 * Rotinas automáticas: lembretes, mensagens de retorno, aniversariantes,
 * pesquisa de satisfação, campanhas agendadas, lista de espera, fidelidade e plano.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private running = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
    private engagement: EngagementService,
    private messaging: MessagingService,
    private billing: BillingService,
  ) {}

  private async guard(name: string, fn: () => Promise<void>) {
    if (this.running.has(name) || process.env.DISABLE_CRON === 'true') return;
    this.running.add(name);
    try {
      await fn();
    } catch (e: any) {
      this.logger.error(`${name}: ${e.message}`, e.stack);
    } finally {
      this.running.delete(name);
    }
  }

  /** Lembretes de horário (a cada 10 min) */
  @Cron('*/10 * * * *')
  reminders() {
    return this.guard('reminders', async () => {
      const tenants = await this.prisma.tenant.findMany({ where: { reminderEnabled: true, isActive: true, deletedAt: null } });
      for (const t of tenants) {
        const windowEnd = new Date(Date.now() + t.reminderHoursBefore * 3600000);
        const list = await this.prisma.appointment.findMany({
          where: { tenantId: t.id, status: { in: ['SCHEDULED', 'CONFIRMED'] }, reminderSentAt: null, deletedAt: null, startAt: { gt: new Date(), lte: windowEnd } },
          include: this.appointments.include,
          take: 50,
        });
        for (const a of list) {
          await this.appointments.notify(t, a, 'REMINDER');
          await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
        }
        if (list.length) this.logger.log(`${t.slug}: ${list.length} lembrete(s)`);
      }
    });
  }

  /** Pesquisa de satisfação 1h após o atendimento concluído (a cada 15 min) */
  @Cron('*/15 * * * *')
  surveys() {
    return this.guard('surveys', async () => {
      const tenants = await this.prisma.tenant.findMany({ where: { surveyEnabled: true, isActive: true, deletedAt: null } });
      for (const t of tenants) {
        const list = await this.prisma.appointment.findMany({
          where: { tenantId: t.id, status: 'COMPLETED', clientId: { not: null }, survey: null, completedAt: { lte: new Date(Date.now() - 3600000), gte: new Date(Date.now() - 2 * 86400000) } },
          include: { client: true },
          take: 50,
        });
        for (const a of list) await this.engagement.createSurveyFor(t, a);
      }
    });
  }

  /** Mensagens de retorno automáticas (todo dia às 10h, horário do servidor) */
  @Cron('0 10 * * *')
  returnMessages() {
    return this.guard('returnMessages', async () => {
      const rules = await this.prisma.returnRule.findMany({ where: { isActive: true }, include: { tenant: true, service: true } });
      for (const rule of rules) {
        if (!rule.tenant.isActive) continue;
        const target = new Date(Date.now() - rule.daysAfter * 86400000);
        const dayStart = new Date(target.getTime() - 12 * 3600000);
        const dayEnd = new Date(target.getTime() + 12 * 3600000);
        const list = await this.prisma.appointment.findMany({
          where: {
            tenantId: rule.tenantId,
            status: 'COMPLETED',
            returnMessageSentAt: null,
            clientId: { not: null },
            completedAt: { gte: dayStart, lte: dayEnd },
            ...(rule.serviceId ? { services: { some: { serviceId: rule.serviceId } } } : {}),
          },
          include: { client: true, services: { include: { service: true } } },
          take: 100,
        });
        for (const a of list) {
          // só envia se o cliente ainda não voltou
          const back = await this.prisma.appointment.count({ where: { tenantId: rule.tenantId, clientId: a.clientId, startAt: { gt: a.startAt }, status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] } } });
          if (back > 0) {
            await this.prisma.appointment.update({ where: { id: a.id }, data: { returnMessageSentAt: new Date() } });
            continue;
          }
          const text = renderTemplate(rule.message, { cliente: a.client!.name.split(' ')[0], barbearia: rule.tenant.name, servico: a.services.map((s) => s.service.name).join(', '), link: `${this.messaging.appUrl()}/b/${rule.tenant.slug}` });
          await this.messaging.send({ tenantId: rule.tenantId, clientId: a.clientId, kind: 'RETURN', channels: rule.channels, phone: a.client!.phone, email: a.client!.email, subject: `Hora de voltar - ${rule.tenant.name}`, text, appointmentId: a.id });
          await this.prisma.appointment.update({ where: { id: a.id }, data: { returnMessageSentAt: new Date() } });
        }
      }
    });
  }

  /** Aniversariantes (todo dia às 9h) */
  @Cron('0 9 * * *')
  birthdays() {
    return this.guard('birthdays', async () => {
      const tenants = await this.prisma.tenant.findMany({ where: { birthdayMessageEnabled: true, isActive: true, deletedAt: null } });
      for (const t of tenants) {
        const today = formatInTimeZone(new Date(), t.timezone, 'MM-dd');
        const clients = await this.prisma.$queryRaw<{ id: string; name: string; phone: string | null; email: string | null }[]>`
          SELECT id, name, phone, email FROM clients WHERE "tenantId" = ${t.id} AND "deletedAt" IS NULL AND "marketingOptIn" AND "birthDate" IS NOT NULL
          AND to_char("birthDate", 'MM-DD') = ${today}`;
        for (const c of clients) {
          const already = await this.prisma.messageLog.count({ where: { tenantId: t.id, clientId: c.id, kind: 'BIRTHDAY', createdAt: { gte: new Date(Date.now() - 86400000) } } });
          if (already) continue;
          const text = renderTemplate(t.birthdayMessage || 'Feliz aniversário, {{cliente}}! 🎉 A {{barbearia}} deseja um dia incrível. Passe aqui para comemorar com um visual novo: {{link}}', { cliente: c.name.split(' ')[0], barbearia: t.name, link: `${this.messaging.appUrl()}/b/${t.slug}` });
          await this.messaging.send({ tenantId: t.id, clientId: c.id, kind: 'BIRTHDAY', channels: ((t.reminderChannels as any) ?? ['WHATSAPP']) as any, phone: c.phone, email: c.email, subject: `Feliz aniversário! - ${t.name}`, text });
        }
      }
    });
  }

  /** Campanhas agendadas (a cada 5 min) */
  @Cron('*/5 * * * *')
  campaigns() {
    return this.guard('campaigns', async () => {
      const due = await this.prisma.campaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } }, take: 10 });
      for (const c of due) await this.engagement.sendCampaign(c.tenantId, c.id);
    });
  }

  /** Lista de espera expira, pontos expiram, encerramentos (diário 3h) */
  @Cron('0 3 * * *')
  housekeeping() {
    return this.guard('housekeeping', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      await this.prisma.waitlistEntry.updateMany({ where: { status: { in: ['WAITING', 'NOTIFIED'] }, date: { lt: yesterday } }, data: { status: 'EXPIRED' } });
      await this.prisma.clientPackage.updateMany({ where: { isActive: true, expiresAt: { lt: new Date() } }, data: { isActive: false } });
      // agendamentos passados ainda "confirmados" ficam como não compareceu? Não: deixamos para a barbearia decidir.
      // expiração de pontos
      const programs = await this.prisma.loyaltyProgram.findMany({ where: { isActive: true, pointsExpireDays: { not: null } } });
      for (const p of programs) {
        const limit = new Date(Date.now() - p.pointsExpireDays! * 86400000);
        const clients = await this.prisma.client.findMany({ where: { tenantId: p.tenantId, loyaltyPoints: { gt: 0 }, OR: [{ lastVisitAt: { lt: limit } }, { lastVisitAt: null, createdAt: { lt: limit } }] } });
        for (const c of clients) {
          await this.prisma.loyaltyTransaction.create({ data: { tenantId: p.tenantId, clientId: c.id, type: 'EXPIRE', points: -c.loyaltyPoints, balanceAfter: 0, description: `Pontos expirados (${p.pointsExpireDays} dias sem visita)` } });
          await this.prisma.client.update({ where: { id: c.id }, data: { loyaltyPoints: 0 } });
        }
      }
      // plano
      await this.billing.generateRenewals();
      await this.billing.enforce();
      // teste grátis: aviso 3 dias antes e no fim
      const tenants = await this.prisma.tenant.findMany({ where: { planStatus: 'TRIAL', trialEndsAt: { not: null }, deletedAt: null } });
      for (const t of tenants) {
        const days = Math.ceil((t.trialEndsAt!.getTime() - Date.now()) / 86400000);
        if ((days === 3 || days === 0) && t.email) {
          const url = `${this.messaging.appUrl()}/app/plano`;
          const msg = days === 3 ? `Olá, ${t.name}! Seu teste grátis do Connect Barber termina em 3 dias. Escolha seu plano para continuar sem interrupção: ${url}` : `Olá, ${t.name}! Seu teste grátis terminou hoje. Escolha um plano para manter sua agenda online no ar: ${url}`;
          await this.messaging['email'].send(t.email, 'Seu teste grátis do Connect Barber', this.messaging.basicHtml(msg));
        }
      }
    });
  }
}
