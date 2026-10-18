import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMovementType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { localDayRange, money } from '../../common/utils';
import { CashMovementDto, CloseCashierDto, OpenCashierDto } from './cashier.dto';

@Injectable()
export class CashierService {
  constructor(private prisma: PrismaService) {}

  async current(tenantId: string) {
    const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    if (!session) return { session: null, summary: null };
    return { session, summary: await this.summary(session.id) };
  }

  async open(tenantId: string, actor: AuthUser, dto: OpenCashierDto) {
    const existing = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
    if (existing) throw new BadRequestException('Já existe um caixa aberto');
    return this.prisma.cashierSession.create({ data: { tenantId, openedById: actor.sub, openingBalance: dto.openingBalance, notes: dto.notes } });
  }

  async addMovement(tenantId: string, actor: AuthUser, dto: CashMovementDto) {
    const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
    if (!session) throw new BadRequestException('Nenhum caixa aberto');
    if (dto.type === 'SALE') throw new BadRequestException('Vendas entram pelas comandas');
    return this.prisma.cashMovement.create({
      data: { tenantId, cashierSessionId: session.id, type: dto.type, method: dto.method ?? 'CASH', amount: dto.amount, description: dto.description, createdById: actor.sub },
    });
  }

  async removeMovement(tenantId: string, id: string) {
    const m = await this.prisma.cashMovement.findFirst({ where: { id, tenantId }, include: { cashierSession: true } });
    if (!m) throw new NotFoundException('Movimentação não encontrada');
    if (m.cashierSession.status === 'CLOSED') throw new BadRequestException('Caixa já fechado');
    if (m.type === 'SALE') throw new BadRequestException('Estorne pela comanda (reabrir)');
    await this.prisma.cashMovement.delete({ where: { id } });
    return { ok: true };
  }

  async close(tenantId: string, actor: AuthUser, dto: CloseCashierDto) {
    const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
    if (!session) throw new BadRequestException('Nenhum caixa aberto');
    const openOrders = await this.prisma.order.count({ where: { tenantId, status: 'OPEN', addToCashier: true, kind: 'CLIENT' } });
    if (openOrders > 0) throw new BadRequestException(`Existem ${openOrders} comanda(s) aberta(s). Feche ou cancele antes de fechar o caixa.`);
    const s = await this.summary(session.id);
    const expected = s.expectedCash;
    return this.prisma.cashierSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: actor.sub, expectedBalance: expected, closingBalance: dto.closingBalance, difference: money(dto.closingBalance - expected), notes: dto.notes ?? session.notes },
    });
  }

  async summary(sessionId: string) {
    const session = await this.prisma.cashierSession.findUniqueOrThrow({ where: { id: sessionId } });
    const movements = await this.prisma.cashMovement.findMany({ where: { cashierSessionId: sessionId }, orderBy: { createdAt: 'asc' } });
    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let cash = Number(session.openingBalance);
    for (const m of movements) {
      const sign = m.type === 'EXPENSE' || m.type === 'WITHDRAWAL' ? -1 : 1;
      const v = sign * Number(m.amount);
      byType[m.type] = money((byType[m.type] ?? 0) + Number(m.amount));
      if (m.type === 'SALE' || m.type === 'INCOME') byMethod[m.method] = money((byMethod[m.method] ?? 0) + Number(m.amount));
      if (m.method === 'CASH') cash += v;
    }
    const sales = byType['SALE'] ?? 0;
    const income = byType['INCOME'] ?? 0;
    const expense = byType['EXPENSE'] ?? 0;
    const withdrawal = byType['WITHDRAWAL'] ?? 0;
    const supply = byType['SUPPLY'] ?? 0;
    return {
      openingBalance: money(session.openingBalance),
      sales,
      income,
      expense,
      withdrawal,
      supply,
      byMethod: Object.entries(byMethod).map(([method, amount]) => ({ method: method as PaymentMethod, amount })),
      expectedCash: money(cash),
      total: money(sales + income - expense - withdrawal + supply),
      movements,
    };
  }

  async history(tenantId: string, q: { from?: string; to?: string; page?: string; limit?: string }) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Number(q.limit) || 30);
    const where = {
      tenantId,
      ...(q.from || q.to
        ? { openedAt: { ...(q.from ? { gte: localDayRange(q.from, tenant.timezone).start } : {}), ...(q.to ? { lte: localDayRange(q.to, tenant.timezone).end } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.cashierSession.findMany({ where, orderBy: { openedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.cashierSession.count({ where }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(items.flatMap((i) => [i.openedById, i.closedById].filter(Boolean) as string[]))] } }, select: { id: true, name: true } });
    const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
    return { items: items.map((i) => ({ ...i, openedBy: name(i.openedById), closedBy: name(i.closedById) })), total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getSession(tenantId: string, id: string) {
    const s = await this.prisma.cashierSession.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Caixa não encontrado');
    return { session: s, summary: await this.summary(id) };
  }

  movementTypes(): CashMovementType[] {
    return ['INCOME', 'EXPENSE', 'WITHDRAWAL', 'SUPPLY'];
  }
}
