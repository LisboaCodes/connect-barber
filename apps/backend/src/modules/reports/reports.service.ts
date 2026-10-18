import { Injectable } from '@nestjs/common';
import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { localDayRange, money, nowLocalDate, parseDateOnly, timeToMinutes } from '../../common/utils';
import { AvailabilityService } from '../appointments/availability.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private availability: AvailabilityService) {}

  private async range(tenantId: string, from: string, to: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return { tenant, start: localDayRange(from, tenant.timezone).start, end: localDayRange(to, tenant.timezone).end };
  }

  /** Dashboard geral */
  async dashboard(tenantId: string, actor: AuthUser, from: string, to: string) {
    const { tenant, start, end } = await this.range(tenantId, from, to);
    const pro = actor.role === MemberRole.PROFESSIONAL ? actor.professionalId : undefined;
    const today = nowLocalDate(tenant.timezone);
    const todayRange = localDayRange(today, tenant.timezone);

    const [orders, prevOrders, appts, todayAppts, newClients, byMethod, topServices, topProducts, byPro, pendingFinance, lowStock, birthdays, openOrders, cashier] = await Promise.all([
      this.prisma.order.aggregate({ where: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end }, ...(pro ? { items: { some: { professionalId: pro } } } : {}) }, _sum: { total: true, discountAmount: true, feesTotal: true }, _count: true }),
      this.prisma.order.aggregate({ where: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: new Date(start.getTime() - (end.getTime() - start.getTime())), lt: start } }, _sum: { total: true }, _count: true }),
      this.prisma.appointment.groupBy({ by: ['status'], where: { tenantId, startAt: { gte: start, lte: end }, deletedAt: null, ...(pro ? { professionalId: pro } : {}) }, _count: true }),
      this.prisma.appointment.findMany({ where: { tenantId, startAt: { gte: todayRange.start, lte: todayRange.end }, deletedAt: null, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }, ...(pro ? { professionalId: pro } : {}) }, include: { client: { select: { name: true } }, professional: { select: { name: true, color: true } }, services: { include: { service: { select: { name: true } } } } }, orderBy: { startAt: 'asc' } }),
      this.prisma.client.count({ where: { tenantId, createdAt: { gte: start, lte: end }, deletedAt: null } }),
      this.prisma.payment.groupBy({ by: ['method'], where: { order: { tenantId, status: 'CLOSED', closedAt: { gte: start, lte: end } } }, _sum: { amount: true } }),
      this.prisma.orderItem.groupBy({ by: ['serviceId'], where: { type: 'SERVICE', order: { tenantId, status: 'CLOSED', closedAt: { gte: start, lte: end } }, ...(pro ? { professionalId: pro } : {}) }, _sum: { total: true, quantity: true }, orderBy: { _sum: { total: 'desc' } }, take: 8 }),
      this.prisma.orderItem.groupBy({ by: ['productId'], where: { type: 'PRODUCT', order: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } }, ...(pro ? { professionalId: pro } : {}) }, _sum: { total: true, quantity: true }, orderBy: { _sum: { total: 'desc' } }, take: 8 }),
      this.prisma.orderItem.groupBy({ by: ['professionalId'], where: { order: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } }, ...(pro ? { professionalId: pro } : {}) }, _sum: { total: true, commissionAmount: true }, _count: true }),
      pro ? null : this.prisma.financeEntry.groupBy({ by: ['type'], where: { tenantId, status: 'PENDING', dueDate: { lte: parseDateOnly(to) } }, _sum: { amount: true }, _count: true }),
      pro ? [] : this.prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM products WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "isActive" AND stock <= "minStock"`,
      this.prisma.$queryRaw<any[]>`SELECT id, name, phone, "birthDate" FROM clients WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "birthDate" IS NOT NULL AND EXTRACT(MONTH FROM "birthDate") = EXTRACT(MONTH FROM (NOW() AT TIME ZONE ${tenant.timezone})) AND EXTRACT(DAY FROM "birthDate") = EXTRACT(DAY FROM (NOW() AT TIME ZONE ${tenant.timezone}))`,
      this.prisma.order.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' }, select: { id: true, openedAt: true } }),
    ]);

    const serviceNames = await this.prisma.service.findMany({ where: { id: { in: topServices.map((s) => s.serviceId!).filter(Boolean) } }, select: { id: true, name: true } });
    const productNames = await this.prisma.product.findMany({ where: { id: { in: topProducts.map((s) => s.productId!).filter(Boolean) } }, select: { id: true, name: true } });
    const proNames = await this.prisma.professional.findMany({ where: { tenantId }, select: { id: true, name: true, color: true } });

    const revenue = money(orders._sum.total);
    const prevRevenue = money(prevOrders._sum.total);
    const count = orders._count;
    const completed = appts.find((a) => a.status === 'COMPLETED')?._count ?? 0;
    const cancelled = appts.find((a) => a.status === 'CANCELLED')?._count ?? 0;
    const noShow = appts.find((a) => a.status === 'NO_SHOW')?._count ?? 0;
    const totalAppts = appts.reduce((s, a) => s + a._count, 0);

    // série diária de faturamento
    const daily = await this.prisma.$queryRaw<{ day: string; total: number; count: number }[]>`
      SELECT to_char(("closedAt" AT TIME ZONE ${tenant.timezone}), 'YYYY-MM-DD') AS day, SUM(total)::float AS total, COUNT(*)::int AS count
      FROM orders WHERE "tenantId" = ${tenantId} AND status = 'CLOSED' AND kind = 'CLIENT' AND "closedAt" BETWEEN ${start} AND ${end}
      GROUP BY 1 ORDER BY 1`;

    return {
      period: { from, to },
      kpis: {
        revenue,
        prevRevenue,
        revenueChangePct: prevRevenue > 0 ? money(((revenue - prevRevenue) / prevRevenue) * 100) : null,
        ordersCount: count,
        averageTicket: count ? money(revenue / count) : 0,
        discounts: money(orders._sum.discountAmount),
        cardFees: money(orders._sum.feesTotal),
        appointments: totalAppts,
        completed,
        cancelled,
        noShow,
        noShowRatePct: totalAppts ? money((noShow / totalAppts) * 100) : 0,
        newClients,
        openOrders,
        cashierOpen: !!cashier,
        lowStockCount: Array.isArray(lowStock) ? lowStock[0]?.count ?? 0 : 0,
        pendingPayables: money(pendingFinance?.find((p) => p.type === 'EXPENSE')?._sum.amount),
        pendingReceivables: money(pendingFinance?.find((p) => p.type === 'INCOME')?._sum.amount),
      },
      daily: daily.map((d) => ({ ...d, total: money(d.total) })),
      byMethod: byMethod.map((m) => ({ method: m.method, amount: money(m._sum.amount) })),
      topServices: topServices.map((s) => ({ id: s.serviceId, name: serviceNames.find((n) => n.id === s.serviceId)?.name ?? '-', total: money(s._sum.total), quantity: Number(s._sum.quantity ?? 0) })),
      topProducts: topProducts.map((s) => ({ id: s.productId, name: productNames.find((n) => n.id === s.productId)?.name ?? '-', total: money(s._sum.total), quantity: Number(s._sum.quantity ?? 0) })),
      byProfessional: byPro.map((p) => ({ id: p.professionalId, name: proNames.find((n) => n.id === p.professionalId)?.name ?? 'Sem profissional', color: proNames.find((n) => n.id === p.professionalId)?.color, total: money(p._sum.total), commission: money(p._sum.commissionAmount), items: p._count })).sort((a, b) => b.total - a.total),
      todayAppointments: todayAppts,
      birthdaysToday: birthdays,
    };
  }

  /** Agendamentos por dia da semana, horário, origem e status */
  async appointments(tenantId: string, actor: AuthUser, from: string, to: string, professionalId?: string) {
    const { tenant, start, end } = await this.range(tenantId, from, to);
    const pro = actor.role === MemberRole.PROFESSIONAL ? actor.professionalId : professionalId;
    const proFilter = pro ? Prisma.sql`AND "professionalId" = ${pro}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ weekday: number; hour: number; source: string; status: string; count: number; revenue: number }[]>`
      SELECT EXTRACT(DOW FROM ("startAt" AT TIME ZONE ${tenant.timezone}))::int AS weekday,
             EXTRACT(HOUR FROM ("startAt" AT TIME ZONE ${tenant.timezone}))::int AS hour,
             source::text AS source, status::text AS status, COUNT(*)::int AS count, SUM("totalPrice")::float AS revenue
      FROM appointments WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "startAt" BETWEEN ${start} AND ${end}
      ${proFilter}
      GROUP BY 1, 2, 3, 4`;
    const agg = (key: 'weekday' | 'hour' | 'source' | 'status') => {
      const m = new Map<string | number, { count: number; revenue: number }>();
      for (const r of rows) {
        const k = r[key];
        const cur = m.get(k) ?? { count: 0, revenue: 0 };
        m.set(k, { count: cur.count + r.count, revenue: money(cur.revenue + (r.status === 'COMPLETED' ? r.revenue : 0)) });
      }
      return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => (a.key > b.key ? 1 : -1));
    };
    const clientsStats = await this.prisma.appointment.groupBy({ by: ['clientId'], where: { tenantId, deletedAt: null, startAt: { gte: start, lte: end }, status: 'COMPLETED', ...(pro ? { professionalId: pro } : {}) }, _count: true, orderBy: { _count: { clientId: 'desc' } }, take: 20 });
    const clientNames = await this.prisma.client.findMany({ where: { id: { in: clientsStats.map((c) => c.clientId!).filter(Boolean) } }, select: { id: true, name: true, phone: true } });
    const proStats = await this.prisma.appointment.groupBy({ by: ['professionalId', 'status'], where: { tenantId, deletedAt: null, startAt: { gte: start, lte: end }, ...(pro ? { professionalId: pro } : {}) }, _count: true });
    const pros = await this.prisma.professional.findMany({ where: { tenantId }, select: { id: true, name: true, color: true } });
    return {
      byWeekday: agg('weekday'),
      byHour: agg('hour'),
      bySource: agg('source'),
      byStatus: agg('status'),
      topClients: clientsStats.map((c) => ({ id: c.clientId, name: clientNames.find((n) => n.id === c.clientId)?.name ?? 'Sem cadastro', phone: clientNames.find((n) => n.id === c.clientId)?.phone, count: c._count })),
      byProfessional: pros.map((p) => ({ id: p.id, name: p.name, color: p.color, total: proStats.filter((s) => s.professionalId === p.id).reduce((a, s) => a + s._count, 0), completed: proStats.find((s) => s.professionalId === p.id && s.status === 'COMPLETED')?._count ?? 0, cancelled: proStats.find((s) => s.professionalId === p.id && s.status === 'CANCELLED')?._count ?? 0, noShow: proStats.find((s) => s.professionalId === p.id && s.status === 'NO_SHOW')?._count ?? 0 })),
    };
  }

  /** Taxa de ocupação: minutos agendados / minutos de jornada por profissional */
  async occupancy(tenantId: string, from: string, to: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const pros = await this.prisma.professional.findMany({ where: { tenantId, isActive: true, deletedAt: null }, select: { id: true, name: true, color: true } });
    const result: { id: string; name: string; color: string; availableMin: number; bookedMin: number; occupancyPct: number }[] = pros.map((p) => ({ ...p, availableMin: 0, bookedMin: 0, occupancyPct: 0 }));
    const startD = parseDateOnly(from);
    const endD = parseDateOnly(to);
    for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const avail = await this.availability.forDate(tenant, ds, 1, {});
      for (const a of avail) {
        const r = result.find((x) => x.id === a.professionalId);
        if (!r) continue;
        r.availableMin += a.working.reduce((s, w) => s + (w.end - w.start), 0);
        r.bookedMin += a.busy.reduce((s, b) => s + Math.max(0, b.end - b.start), 0);
      }
    }
    for (const r of result) r.occupancyPct = r.availableMin ? money((r.bookedMin / r.availableMin) * 100) : 0;
    const totals = { availableMin: result.reduce((s, r) => s + r.availableMin, 0), bookedMin: result.reduce((s, r) => s + r.bookedMin, 0) };
    return { from, to, professionals: result, average: totals.availableMin ? money((totals.bookedMin / totals.availableMin) * 100) : 0 };
  }

  /** Taxa de retorno: clientes que voltaram dentro de N dias após uma visita no período */
  async retention(tenantId: string, from: string, to: string, windowDays = 45) {
    const { start, end } = await this.range(tenantId, from, to);
    const visits = await this.prisma.appointment.findMany({ where: { tenantId, status: 'COMPLETED', deletedAt: null, startAt: { gte: start, lte: end }, clientId: { not: null } }, select: { clientId: true, startAt: true }, orderBy: { startAt: 'asc' } });
    const firstVisit = new Map<string, Date>();
    for (const v of visits) if (!firstVisit.has(v.clientId!)) firstVisit.set(v.clientId!, v.startAt);
    let returned = 0;
    for (const [clientId, date] of firstVisit) {
      const next = await this.prisma.appointment.findFirst({ where: { tenantId, clientId, status: 'COMPLETED', deletedAt: null, startAt: { gt: date, lte: new Date(date.getTime() + windowDays * 86400000) } } });
      if (next) returned++;
    }
    const clients = firstVisit.size;
    const inactive = await this.prisma.client.count({ where: { tenantId, deletedAt: null, visitsCount: { gt: 0 }, lastVisitAt: { lt: new Date(Date.now() - windowDays * 86400000) } } });
    return { from, to, windowDays, clients, returned, returnRatePct: clients ? money((returned / clients) * 100) : 0, inactiveClients: inactive };
  }

  /** Relatório financeiro detalhado: receitas por categoria/forma, despesas por categoria, lucro bruto */
  async financial(tenantId: string, from: string, to: string) {
    const { tenant, start, end } = await this.range(tenantId, from, to);
    const [sales, byType, byMethod, expenses, productsCost, commissions] = await Promise.all([
      this.prisma.order.aggregate({ where: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } }, _sum: { total: true, subtotal: true, discountAmount: true, feesTotal: true }, _count: true }),
      this.prisma.orderItem.groupBy({ by: ['type'], where: { order: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } } }, _sum: { total: true } }),
      this.prisma.payment.groupBy({ by: ['method'], where: { order: { tenantId, status: 'CLOSED', closedAt: { gte: start, lte: end } } }, _sum: { amount: true, feeAmount: true, netAmount: true } }),
      this.prisma.financeEntry.groupBy({ by: ['categoryId', 'type'], where: { tenantId, status: 'PAID', paidAt: { gte: start, lte: end } }, _sum: { paidAmount: true } }),
      this.prisma.$queryRaw<{ cost: number }[]>`
        SELECT COALESCE(SUM(oi.quantity * p."costPrice"), 0)::float AS cost FROM order_items oi JOIN products p ON p.id = oi."productId" JOIN orders o ON o.id = oi."orderId"
        WHERE o."tenantId" = ${tenantId} AND o.status = 'CLOSED' AND o.kind = 'CLIENT' AND o."closedAt" BETWEEN ${start} AND ${end} AND oi.type = 'PRODUCT'`,
      this.prisma.commissionEntry.aggregate({ where: { tenantId, referenceDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) }, status: { not: 'CANCELLED' } }, _sum: { amount: true } }),
    ]);
    const cats = await this.prisma.financeCategory.findMany({ where: { tenantId } });
    const revenue = money(sales._sum.total);
    const otherIncome = money(expenses.filter((e) => e.type === 'INCOME').reduce((s, e) => s + Number(e._sum.paidAmount ?? 0), 0));
    const expensesTotal = money(expenses.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + Number(e._sum.paidAmount ?? 0), 0));
    const cogs = money(productsCost[0]?.cost ?? 0);
    const comm = money(commissions._sum.amount);
    const fees = money(sales._sum.feesTotal);
    return {
      period: { from, to, timezone: tenant.timezone },
      revenue: { total: revenue, services: money(byType.find((t) => t.type === 'SERVICE')?._sum.total), products: money(byType.find((t) => t.type === 'PRODUCT')?._sum.total), packages: money(byType.find((t) => t.type === 'PACKAGE')?._sum.total), other: money(byType.find((t) => t.type === 'CUSTOM')?._sum.total), discounts: money(sales._sum.discountAmount), orders: sales._count, averageTicket: sales._count ? money(revenue / sales._count) : 0, otherIncome },
      byMethod: byMethod.map((m) => ({ method: m.method, amount: money(m._sum.amount), fees: money(m._sum.feeAmount), net: money(m._sum.netAmount) })),
      expenses: { total: expensesTotal, byCategory: expenses.filter((e) => e.type === 'EXPENSE').map((e) => ({ category: cats.find((c) => c.id === e.categoryId)?.name ?? 'Sem categoria', amount: money(e._sum.paidAmount) })).sort((a, b) => b.amount - a.amount), commissions: comm, productsCost: cogs, cardFees: fees },
      result: { grossProfit: money(revenue - cogs - comm - fees), netResult: money(revenue + otherIncome - cogs - comm - fees - expensesTotal) },
    };
  }

  /** Movimentações detalhadas (comandas fechadas com itens e pagamentos) para exportação */
  async movements(tenantId: string, from: string, to: string) {
    const { start, end } = await this.range(tenantId, from, to);
    return this.prisma.order.findMany({
      where: { tenantId, status: 'CLOSED', closedAt: { gte: start, lte: end } },
      include: { client: { select: { name: true, phone: true } }, professional: { select: { name: true } }, items: { include: { professional: { select: { name: true } } } }, payments: true },
      orderBy: { closedAt: 'asc' },
    });
  }

  /** Ticket médio: por comanda, por cliente e por profissional */
  async averageTicket(tenantId: string, from: string, to: string) {
    const { start, end } = await this.range(tenantId, from, to);
    const orders = await this.prisma.order.findMany({ where: { tenantId, status: 'CLOSED', kind: 'CLIENT', closedAt: { gte: start, lte: end } }, select: { total: true, clientId: true, professionalId: true } });
    const total = money(orders.reduce((s, o) => s + Number(o.total), 0));
    const clients = new Set(orders.map((o) => o.clientId).filter(Boolean)).size;
    const byPro = new Map<string, { total: number; count: number }>();
    for (const o of orders) {
      const k = o.professionalId ?? 'none';
      const cur = byPro.get(k) ?? { total: 0, count: 0 };
      byPro.set(k, { total: cur.total + Number(o.total), count: cur.count + 1 });
    }
    const pros = await this.prisma.professional.findMany({ where: { tenantId }, select: { id: true, name: true } });
    return {
      perOrder: orders.length ? money(total / orders.length) : 0,
      perClient: clients ? money(total / clients) : 0,
      orders: orders.length,
      clients,
      total,
      byProfessional: [...byPro.entries()].map(([id, v]) => ({ id, name: pros.find((p) => p.id === id)?.name ?? 'Sem profissional', average: money(v.total / v.count), count: v.count, total: money(v.total) })),
    };
  }
}

// evita import não usado
void timeToMinutes;
