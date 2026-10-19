import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanCode, PlanStatus } from '@prisma/client';
import { addDays } from 'date-fns';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { money } from '../../common/utils';
import { BillingModule } from '../billing/billing.module';
import { BillingService } from '../billing/billing.service';
import { PLANS } from '../billing/plans';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user?.isSuperAdmin) throw new ForbiddenException('Acesso restrito à administração da plataforma');
    return true;
  }
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private billing: BillingService) {}

  async overview() {
    const [tenants, byStatus, users, appointments30, revenue30, invoicesOpen] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.groupBy({ by: ['planStatus'], where: { deletedAt: null }, _count: true }),
      this.prisma.user.count(),
      this.prisma.appointment.count({ where: { createdAt: { gte: addDays(new Date(), -30) } } }),
      this.prisma.order.aggregate({ where: { status: 'CLOSED', closedAt: { gte: addDays(new Date(), -30) } }, _sum: { total: true } }),
      this.prisma.invoice.aggregate({ where: { status: { in: ['OPEN', 'OVERDUE'] } }, _sum: { amount: true }, _count: true }),
    ]);
    const mrr = await this.prisma.tenant.findMany({ where: { planStatus: 'ACTIVE' }, select: { planCode: true } });
    return {
      tenants,
      byStatus: byStatus.map((s) => ({ status: s.planStatus, count: s._count })),
      users,
      appointmentsLast30d: appointments30,
      gmvLast30d: money(revenue30._sum.total),
      mrr: money(mrr.reduce((s, t) => s + (PLANS.find((p) => p.code === t.planCode)?.promoPrice ?? 0), 0)),
      openInvoices: { count: invoicesOpen._count, amount: money(invoicesOpen._sum.amount) },
    };
  }

  async listTenants(q: { search?: string; status?: string; page?: string; limit?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Number(q.limit) || 30);
    const where = {
      deletedAt: null,
      ...(q.status ? { planStatus: q.status as PlanStatus } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' as const } }, { slug: { contains: q.search, mode: 'insensitive' as const } }, { email: { contains: q.search, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        select: { id: true, name: true, slug: true, email: true, phone: true, addressCity: true, addressState: true, planCode: true, planStatus: true, trialEndsAt: true, planRenewsAt: true, createdAt: true, isActive: true, onboardingStep: true, _count: { select: { professionals: true, clients: true, appointments: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getTenant(id: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id }, include: { memberships: { include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } } }, invoices: { orderBy: { dueDate: 'desc' }, take: 24 } } });
    const [orders, lastAppointment] = await Promise.all([
      this.prisma.order.aggregate({ where: { tenantId: id, status: 'CLOSED' }, _sum: { total: true }, _count: true }),
      this.prisma.appointment.findFirst({ where: { tenantId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return { ...t, stats: { orders: orders._count, gmv: money(orders._sum.total), lastAppointmentAt: lastAppointment?.createdAt ?? null } };
  }

  async updateTenant(id: string, body: { planCode?: PlanCode; planStatus?: PlanStatus; trialEndsAt?: string; planRenewsAt?: string; isActive?: boolean; maxProfessionals?: number; extendTrialDays?: number }) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const data: any = {};
    if (body.planCode) {
      data.planCode = body.planCode;
      data.maxProfessionals = PLANS.find((p) => p.code === body.planCode)?.maxProfessionals ?? 999;
    }
    if (body.planStatus) data.planStatus = body.planStatus;
    if (body.trialEndsAt) data.trialEndsAt = new Date(body.trialEndsAt);
    if (body.extendTrialDays) data.trialEndsAt = addDays(t.trialEndsAt ?? new Date(), body.extendTrialDays);
    if (body.planRenewsAt) data.planRenewsAt = new Date(body.planRenewsAt);
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.maxProfessionals) data.maxProfessionals = body.maxProfessionals;
    return this.prisma.tenant.update({ where: { id }, data });
  }

  markInvoicePaid(invoiceId: string) {
    return this.billing.markInvoicePaid(invoiceId);
  }

  async billingStatus() {
    const test = await this.billing.testConnection();
    return { creativePay: { configured: this.billing.enabled, ...test } };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview') overview() { return this.admin.overview(); }
  @Get('tenants') tenants(@Query() q: any) { return this.admin.listTenants(q); }
  @Get('tenants/:id') tenant(@Param('id') id: string) { return this.admin.getTenant(id); }
  @Patch('tenants/:id') update(@Param('id') id: string, @Body() body: any) { return this.admin.updateTenant(id, body); }
  @Post('invoices/:id/pay') pay(@Param('id') id: string) { return this.admin.markInvoicePaid(id); }
  @Get('billing/status') billingStatus() { return this.admin.billingStatus(); }
}

@Module({
  imports: [BillingModule],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
})
export class AdminModule {}
