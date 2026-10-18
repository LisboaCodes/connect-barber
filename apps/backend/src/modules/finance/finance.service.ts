import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceStatus, FinanceType, Prisma } from '@prisma/client';
import { addMonths } from 'date-fns';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { dateOnlyStr, localDayRange, money, paged, paging, parseDateOnly, randomToken } from '../../common/utils';
import { CreateFinanceEntryDto, FinanceCategoryDto, PayFinanceEntryDto, UpdateFinanceEntryDto } from './finance.dto';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, q: { type?: string; status?: string; from?: string; to?: string; categoryId?: string; search?: string; page?: string; limit?: string; overdue?: string }) {
    const p = paging(q, 50);
    const where: Prisma.FinanceEntryWhereInput = { tenantId };
    if (q.type) where.type = q.type as FinanceType;
    if (q.status) where.status = { in: q.status.split(',') as FinanceStatus[] };
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.search) where.OR = [{ description: { contains: q.search, mode: 'insensitive' } }, { supplier: { contains: q.search, mode: 'insensitive' } }];
    if (q.from || q.to) where.dueDate = { ...(q.from ? { gte: parseDateOnly(q.from) } : {}), ...(q.to ? { lte: parseDateOnly(q.to) } : {}) };
    if (q.overdue === 'true') {
      where.status = 'PENDING';
      where.dueDate = { lt: parseDateOnly(dateOnlyStr(new Date())) };
    }
    const [items, total, sums] = await Promise.all([
      this.prisma.financeEntry.findMany({ where, include: { category: { select: { id: true, name: true } } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }], skip: p.skip, take: p.take }),
      this.prisma.financeEntry.count({ where }),
      this.prisma.financeEntry.groupBy({ by: ['type', 'status'], where, _sum: { amount: true, paidAmount: true } }),
    ]);
    const today = dateOnlyStr(new Date());
    return {
      ...paged(items.map((i) => ({ ...i, overdue: i.status === 'PENDING' && dateOnlyStr(i.dueDate) < today })), total, p),
      totals: sums.map((s) => ({ type: s.type, status: s.status, amount: money(s._sum.amount), paid: money(s._sum.paidAmount) })),
    };
  }

  async get(tenantId: string, id: string) {
    const e = await this.prisma.financeEntry.findFirst({ where: { id, tenantId }, include: { category: true, order: { select: { id: true, number: true } } } });
    if (!e) throw new NotFoundException('Lançamento não encontrado');
    return e;
  }

  async create(tenantId: string, actor: AuthUser, dto: CreateFinanceEntryDto) {
    const n = dto.installments ?? 1;
    const groupId = n > 1 ? randomToken(12) : null;
    const base = parseDateOnly(dto.dueDate.slice(0, 10));
    const per = n > 1 ? money(dto.amount / n) : money(dto.amount);
    const created = [];
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 && n > 1 ? money(dto.amount - per * (n - 1)) : per;
      const e = await this.prisma.financeEntry.create({
        data: {
          tenantId,
          type: dto.type,
          description: n > 1 ? `${dto.description} (${i + 1}/${n})` : dto.description,
          amount,
          dueDate: addMonths(base, i),
          categoryId: dto.categoryId ?? undefined,
          supplier: dto.supplier,
          notes: dto.notes,
          groupId,
          installment: n > 1 ? i + 1 : null,
          installments: n > 1 ? n : null,
          createdById: actor.sub,
        },
      });
      created.push(e);
    }
    if (dto.paid && created.length === 1) {
      return [await this.pay(tenantId, actor, created[0].id, { method: dto.method, addToCashier: dto.addToCashier })];
    }
    return created;
  }

  async update(tenantId: string, id: string, dto: UpdateFinanceEntryDto) {
    const e = await this.get(tenantId, id);
    if (e.status === 'PAID') throw new BadRequestException('Lançamento pago não pode ser alterado; estorne antes');
    return this.prisma.financeEntry.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? parseDateOnly(dto.dueDate.slice(0, 10)) : undefined, categoryId: dto.categoryId === undefined ? undefined : dto.categoryId },
    });
  }

  async pay(tenantId: string, actor: AuthUser, id: string, dto: PayFinanceEntryDto) {
    const e = await this.get(tenantId, id);
    if (e.status !== 'PENDING') throw new BadRequestException('Lançamento não está pendente');
    const paidAmount = money(dto.paidAmount ?? Number(e.amount));
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const updated = await this.prisma.financeEntry.update({ where: { id }, data: { status: 'PAID', paidAt, paidAmount, method: dto.method ?? 'CASH' } });
    if (dto.addToCashier) {
      const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' } });
      if (!session) throw new BadRequestException('Nenhum caixa aberto para lançar');
      await this.prisma.cashMovement.create({
        data: { tenantId, cashierSessionId: session.id, type: e.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME', method: dto.method ?? 'CASH', amount: paidAmount, description: e.description, financeEntryId: e.id, createdById: actor.sub },
      });
    }
    return updated;
  }

  async unpay(tenantId: string, id: string) {
    const e = await this.get(tenantId, id);
    if (e.status !== 'PAID') throw new BadRequestException('Lançamento não está pago');
    const mv = await this.prisma.cashMovement.findFirst({ where: { financeEntryId: id }, include: { cashierSession: true } });
    if (mv) {
      if (mv.cashierSession.status === 'CLOSED') throw new BadRequestException('O caixa deste pagamento já foi fechado');
      await this.prisma.cashMovement.delete({ where: { id: mv.id } });
    }
    return this.prisma.financeEntry.update({ where: { id }, data: { status: 'PENDING', paidAt: null, paidAmount: null, method: null } });
  }

  async cancel(tenantId: string, id: string) {
    const e = await this.get(tenantId, id);
    if (e.status === 'PAID') throw new BadRequestException('Estorne o pagamento antes de cancelar');
    return this.prisma.financeEntry.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async remove(tenantId: string, id: string) {
    const e = await this.get(tenantId, id);
    if (e.status === 'PAID') throw new BadRequestException('Estorne o pagamento antes de excluir');
    await this.prisma.financeEntry.delete({ where: { id } });
    return { ok: true };
  }

  /** Fluxo de caixa: entradas (comandas fechadas + receitas pagas) x saídas (despesas pagas + comissões pagas) por dia */
  async cashflow(tenantId: string, from: string, to: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const start = localDayRange(from, tenant.timezone).start;
    const end = localDayRange(to, tenant.timezone).end;
    const [orders, entries, payouts, fees] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; total: number; count: number }[]>`
        SELECT to_char(("closedAt" AT TIME ZONE ${tenant.timezone}), 'YYYY-MM-DD') AS day, SUM(total)::float AS total, COUNT(*)::int AS count
        FROM orders WHERE "tenantId" = ${tenantId} AND status = 'CLOSED' AND kind = 'CLIENT' AND "closedAt" BETWEEN ${start} AND ${end}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: string; type: string; total: number }[]>`
        SELECT to_char(("paidAt" AT TIME ZONE ${tenant.timezone}), 'YYYY-MM-DD') AS day, type::text AS type, SUM("paidAmount")::float AS total
        FROM finance_entries WHERE "tenantId" = ${tenantId} AND status = 'PAID' AND "paidAt" BETWEEN ${start} AND ${end} AND "orderId" IS NULL
        GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: string; total: number }[]>`
        SELECT to_char(("paidAt" AT TIME ZONE ${tenant.timezone}), 'YYYY-MM-DD') AS day, SUM("netAmount")::float AS total
        FROM commission_payouts WHERE "tenantId" = ${tenantId} AND "paidAt" BETWEEN ${start} AND ${end}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.order.aggregate({ where: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } }, _sum: { feesTotal: true } }),
    ]);
    const days: Record<string, { day: string; sales: number; otherIncome: number; expenses: number; commissions: number; balance: number }> = {};
    const d = (k: string) => (days[k] ??= { day: k, sales: 0, otherIncome: 0, expenses: 0, commissions: 0, balance: 0 });
    for (const o of orders) d(o.day).sales = money(o.total);
    for (const e of entries) {
      if (e.type === 'INCOME') d(e.day).otherIncome = money(e.total);
      else d(e.day).expenses = money(e.total);
    }
    for (const p of payouts) d(p.day).commissions = money(p.total);
    const rows = Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
    let running = 0;
    for (const r of rows) {
      r.balance = money(r.sales + r.otherIncome - r.expenses - r.commissions);
      running = money(running + r.balance);
    }
    const totals = {
      sales: money(rows.reduce((s, r) => s + r.sales, 0)),
      otherIncome: money(rows.reduce((s, r) => s + r.otherIncome, 0)),
      expenses: money(rows.reduce((s, r) => s + r.expenses, 0)),
      commissions: money(rows.reduce((s, r) => s + r.commissions, 0)),
      cardFees: money(fees._sum.feesTotal),
      balance: running,
    };
    const pending = await this.prisma.financeEntry.groupBy({ by: ['type'], where: { tenantId, status: 'PENDING' }, _sum: { amount: true } });
    return { from, to, days: rows, totals, pending: pending.map((p) => ({ type: p.type, amount: money(p._sum.amount) })) };
  }

  // categorias
  listCategories(tenantId: string) {
    return this.prisma.financeCategory.findMany({ where: { tenantId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }
  createCategory(tenantId: string, dto: FinanceCategoryDto) {
    return this.prisma.financeCategory.create({ data: { tenantId, name: dto.name.trim(), type: dto.type } });
  }
  async updateCategory(tenantId: string, id: string, dto: FinanceCategoryDto) {
    const c = await this.prisma.financeCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.financeCategory.update({ where: { id }, data: { name: dto.name.trim(), type: dto.type } });
  }
  async removeCategory(tenantId: string, id: string) {
    const c = await this.prisma.financeCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Categoria não encontrada');
    if (c.isSystem) throw new BadRequestException('Categoria padrão não pode ser removida');
    await this.prisma.financeCategory.delete({ where: { id } });
    return { ok: true };
  }
}
