import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { localDayRange, money, parseDateOnly } from '../../common/utils';
import { CreateAdvanceDto, CreatePayoutDto } from './commissions.dto';

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  private scope(actor: AuthUser, professionalId?: string) {
    if (actor.role === MemberRole.PROFESSIONAL) {
      if (professionalId && professionalId !== actor.professionalId) throw new ForbiddenException('Você só pode ver as próprias comissões');
      return actor.professionalId ?? '__none__';
    }
    return professionalId;
  }

  /** Resumo por profissional no período (pendente x pago) */
  async summary(tenantId: string, actor: AuthUser, from: string, to: string, professionalId?: string) {
    const pid = this.scope(actor, professionalId);
    const where = { tenantId, referenceDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) }, ...(pid ? { professionalId: pid } : {}), status: { not: 'CANCELLED' as const } };
    const [groups, pros, advances] = await Promise.all([
      this.prisma.commissionEntry.groupBy({ by: ['professionalId', 'status'], where, _sum: { amount: true, baseAmount: true }, _count: true }),
      this.prisma.professional.findMany({ where: { tenantId, deletedAt: null, ...(pid ? { id: pid } : {}) }, select: { id: true, name: true, color: true, avatarUrl: true, serviceCommissionPct: true, productCommissionPct: true } }),
      this.prisma.professionalAdvance.groupBy({ by: ['professionalId'], where: { tenantId, status: 'OPEN', ...(pid ? { professionalId: pid } : {}) }, _sum: { amount: true } }),
    ]);
    const byType = await this.prisma.commissionEntry.findMany({ where, select: { professionalId: true, amount: true, orderItem: { select: { type: true } } } });
    return pros.map((p) => {
      const g = groups.filter((x) => x.professionalId === p.id);
      const pending = g.find((x) => x.status === 'PENDING');
      const paid = g.find((x) => x.status === 'PAID');
      const services = byType.filter((x) => x.professionalId === p.id && x.orderItem.type === 'SERVICE').reduce((s, x) => s + Number(x.amount), 0);
      const products = byType.filter((x) => x.professionalId === p.id && x.orderItem.type === 'PRODUCT').reduce((s, x) => s + Number(x.amount), 0);
      return {
        professional: p,
        pending: money(pending?._sum.amount),
        pendingCount: pending?._count ?? 0,
        paid: money(paid?._sum.amount),
        base: money((pending?._sum.baseAmount ?? 0) as any) + money((paid?._sum.baseAmount ?? 0) as any),
        services: money(services),
        products: money(products),
        openAdvances: money(advances.find((a) => a.professionalId === p.id)?._sum.amount),
      };
    });
  }

  async entries(tenantId: string, actor: AuthUser, q: { from?: string; to?: string; professionalId?: string; status?: string; page?: string; limit?: string }) {
    const pid = this.scope(actor, q.professionalId);
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Number(q.limit) || 100);
    const where = {
      tenantId,
      ...(pid ? { professionalId: pid } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.from || q.to ? { referenceDate: { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: parseDateOnly(q.to) } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.commissionEntry.findMany({
        where,
        include: { professional: { select: { id: true, name: true } }, order: { select: { id: true, number: true, closedAt: true, client: { select: { name: true } } } }, orderItem: { select: { description: true, type: true, quantity: true } } },
        orderBy: { referenceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commissionEntry.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ---------------- vales ----------------
  async listAdvances(tenantId: string, actor: AuthUser, professionalId?: string, status?: string) {
    const pid = this.scope(actor, professionalId);
    return this.prisma.professionalAdvance.findMany({
      where: { tenantId, ...(pid ? { professionalId: pid } : {}), ...(status ? { status: status as any } : {}) },
      include: { professional: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async createAdvance(tenantId: string, actor: AuthUser, dto: CreateAdvanceDto) {
    const pro = await this.prisma.professional.findFirst({ where: { id: dto.professionalId, tenantId } });
    if (!pro) throw new NotFoundException('Profissional não encontrado');
    const adv = await this.prisma.professionalAdvance.create({
      data: { tenantId, professionalId: pro.id, amount: dto.amount, description: dto.description, date: dto.date ? parseDateOnly(dto.date.slice(0, 10)) : new Date(), createdById: actor.sub },
    });
    if (dto.addToCashier) {
      const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
      if (!session) throw new BadRequestException('Nenhum caixa aberto');
      await this.prisma.cashMovement.create({ data: { tenantId, cashierSessionId: session.id, type: 'EXPENSE', method: 'CASH', amount: dto.amount, description: `Vale - ${pro.name}${dto.description ? ': ' + dto.description : ''}`, createdById: actor.sub } });
    }
    return adv;
  }

  async cancelAdvance(tenantId: string, id: string) {
    const a = await this.prisma.professionalAdvance.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Vale não encontrado');
    if (a.status !== 'OPEN') throw new BadRequestException('Vale já quitado');
    return this.prisma.professionalAdvance.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ---------------- fechamento ----------------
  /** Prévia do fechamento */
  async preview(tenantId: string, dto: CreatePayoutDto) {
    const pro = await this.prisma.professional.findFirst({ where: { id: dto.professionalId, tenantId } });
    if (!pro) throw new NotFoundException('Profissional não encontrado');
    const start = parseDateOnly(dto.periodStart.slice(0, 10));
    const end = parseDateOnly(dto.periodEnd.slice(0, 10));
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const [entries, advances, consumption] = await Promise.all([
      this.prisma.commissionEntry.findMany({ where: { tenantId, professionalId: pro.id, status: 'PENDING', referenceDate: { gte: start, lte: end } }, include: { orderItem: { select: { description: true, type: true } }, order: { select: { number: true } } } }),
      dto.deductAdvances === false ? ([] as any[]) : this.prisma.professionalAdvance.findMany({ where: { tenantId, professionalId: pro.id, status: 'OPEN' } }),
      dto.deductConsumption === false
        ? ([] as any[])
        : this.prisma.order.findMany({
            where: { tenantId, professionalId: pro.id, kind: 'PROFESSIONAL_CONSUMPTION', status: 'CLOSED', closedAt: { gte: localDayRange(dto.periodStart.slice(0, 10), tenant.timezone).start, lte: localDayRange(dto.periodEnd.slice(0, 10), tenant.timezone).end } },
            select: { id: true, number: true, total: true, closedAt: true },
          }),
    ]);
    const commissionsTotal = money(entries.reduce((s, e) => s + Number(e.amount), 0));
    const advancesTotal = money((advances as any[]).reduce((s: number, a: any) => s + Number(a.amount), 0));
    const consumptionTotal = money((consumption as any[]).reduce((s: number, c: any) => s + Number(c.total), 0));
    return { professional: { id: pro.id, name: pro.name }, periodStart: dto.periodStart, periodEnd: dto.periodEnd, entries, advances, consumption, commissionsTotal, advancesTotal, consumptionTotal, netAmount: money(commissionsTotal - advancesTotal - consumptionTotal) };
  }

  async createPayout(tenantId: string, actor: AuthUser, dto: CreatePayoutDto) {
    const p = await this.preview(tenantId, dto);
    if (p.entries.length === 0 && p.advances.length === 0) throw new BadRequestException('Nenhuma comissão pendente no período');
    const payout = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.commissionPayout.create({
        data: {
          tenantId,
          professionalId: dto.professionalId,
          periodStart: parseDateOnly(dto.periodStart.slice(0, 10)),
          periodEnd: parseDateOnly(dto.periodEnd.slice(0, 10)),
          commissionsTotal: p.commissionsTotal,
          advancesTotal: p.advancesTotal,
          consumptionTotal: p.consumptionTotal,
          netAmount: p.netAmount,
          paidAt: dto.paid ? new Date() : null,
          method: dto.paid ? dto.method ?? 'CASH' : null,
          notes: dto.notes,
          createdById: actor.sub,
        },
      });
      await tx.commissionEntry.updateMany({ where: { id: { in: p.entries.map((e) => e.id) } }, data: { status: 'PAID', payoutId: payout.id } });
      await tx.professionalAdvance.updateMany({ where: { id: { in: p.advances.map((a) => a.id) } }, data: { status: 'SETTLED', payoutId: payout.id } });
      if (dto.paid) {
        const cat = await tx.financeCategory.findFirst({ where: { tenantId, type: 'EXPENSE', name: 'Comissões' } });
        await tx.financeEntry.create({
          data: { tenantId, type: 'EXPENSE', status: 'PAID', categoryId: cat?.id, description: `Comissões ${p.professional.name} (${dto.periodStart} a ${dto.periodEnd})`, amount: p.netAmount, dueDate: new Date(), paidAt: new Date(), paidAmount: p.netAmount, method: dto.method ?? 'CASH', createdById: actor.sub },
        });
        if (dto.addToCashier) {
          const session = await tx.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
          if (session) await tx.cashMovement.create({ data: { tenantId, cashierSessionId: session.id, type: 'EXPENSE', method: dto.method ?? 'CASH', amount: p.netAmount, description: `Pagamento de comissões - ${p.professional.name}`, createdById: actor.sub } });
        }
      }
      return payout;
    });
    return this.getPayout(tenantId, payout.id);
  }

  async markPayoutPaid(tenantId: string, actor: AuthUser, id: string, method?: string, addToCashier?: boolean) {
    const payout = await this.getPayout(tenantId, id);
    if (payout.paidAt) throw new BadRequestException('Fechamento já pago');
    await this.prisma.$transaction(async (tx) => {
      await tx.commissionPayout.update({ where: { id }, data: { paidAt: new Date(), method: (method as any) ?? 'CASH' } });
      const cat = await tx.financeCategory.findFirst({ where: { tenantId, type: 'EXPENSE', name: 'Comissões' } });
      await tx.financeEntry.create({
        data: { tenantId, type: 'EXPENSE', status: 'PAID', categoryId: cat?.id, description: `Comissões ${payout.professional.name}`, amount: payout.netAmount, dueDate: new Date(), paidAt: new Date(), paidAmount: payout.netAmount, method: (method as any) ?? 'CASH', createdById: actor.sub },
      });
      if (addToCashier) {
        const session = await tx.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
        if (session) await tx.cashMovement.create({ data: { tenantId, cashierSessionId: session.id, type: 'EXPENSE', method: (method as any) ?? 'CASH', amount: payout.netAmount, description: `Pagamento de comissões - ${payout.professional.name}`, createdById: actor.sub } });
      }
    });
    return this.getPayout(tenantId, id);
  }

  async listPayouts(tenantId: string, actor: AuthUser, professionalId?: string) {
    const pid = this.scope(actor, professionalId);
    return this.prisma.commissionPayout.findMany({ where: { tenantId, ...(pid ? { professionalId: pid } : {}) }, include: { professional: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async getPayout(tenantId: string, id: string) {
    const p = await this.prisma.commissionPayout.findFirst({
      where: { id, tenantId },
      include: { professional: { select: { id: true, name: true } }, entries: { include: { orderItem: { select: { description: true, type: true } }, order: { select: { number: true, closedAt: true } } } }, advances: true },
    });
    if (!p) throw new NotFoundException('Fechamento não encontrado');
    return p;
  }

  async deletePayout(tenantId: string, id: string) {
    const p = await this.getPayout(tenantId, id);
    if (p.paidAt) throw new BadRequestException('Fechamento pago não pode ser desfeito');
    await this.prisma.$transaction([
      this.prisma.commissionEntry.updateMany({ where: { payoutId: id }, data: { status: 'PENDING', payoutId: null } }),
      this.prisma.professionalAdvance.updateMany({ where: { payoutId: id }, data: { status: 'OPEN', payoutId: null } }),
      this.prisma.commissionPayout.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
