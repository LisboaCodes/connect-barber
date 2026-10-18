import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone, parseDateOnly, randomToken, timeToMinutes } from '../../common/utils';
import { defaultWorkSchedule } from '../auth/auth.service';
import { PLANS } from '../billing/plans';
import {
  CreateBlockDto,
  CreateOverrideDto,
  CreateProfessionalDto,
  SetWorkScheduleDto,
  UpdateProfessionalDto,
} from './professionals.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  private readonly include = {
    membership: { select: { id: true, role: true, isActive: true, user: { select: { id: true, email: true, name: true } } } },
    services: { select: { serviceId: true, price: true, durationMinutes: true } },
    workSchedules: { orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }] },
  };

  list(tenantId: string, includeInactive = false) {
    return this.prisma.professional.findMany({
      where: { tenantId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      include: this.include,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const p = await this.prisma.professional.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { ...this.include, scheduleOverrides: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } } },
    });
    if (!p) throw new NotFoundException('Profissional não encontrado');
    return p;
  }

  async create(tenantId: string, dto: CreateProfessionalDto) {
    await this.assertPlanLimit(tenantId);
    const count = await this.prisma.professional.count({ where: { tenantId, deletedAt: null } });
    const pro = await this.prisma.professional.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        phone: normalizePhone(dto.phone),
        email: dto.email?.toLowerCase().trim(),
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        color: dto.color ?? pickColor(count),
        displayOrder: dto.displayOrder ?? count,
        showOnSite: dto.showOnSite ?? true,
        acceptsOnlineBooking: dto.acceptsOnlineBooking ?? true,
        serviceCommissionPct: dto.serviceCommissionPct ?? 0,
        productCommissionPct: dto.productCommissionPct ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.prisma.workSchedule.createMany({ data: defaultWorkSchedule(pro.id) });
    if (dto.serviceIds?.length) await this.setServices(tenantId, pro.id, dto.serviceIds);
    let generatedPassword: string | undefined;
    if (dto.createAccess) {
      generatedPassword = await this.createAccess(tenantId, pro.id, dto.password);
    }
    return { ...(await this.get(tenantId, pro.id)), generatedPassword };
  }

  async update(tenantId: string, id: string, dto: UpdateProfessionalDto) {
    await this.get(tenantId, id);
    const { serviceIds, createAccess, password, ...rest } = dto;
    const data: any = { ...rest };
    if (dto.phone !== undefined) data.phone = normalizePhone(dto.phone);
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase().trim();
    if (dto.name) data.name = dto.name.trim();
    if (dto.isActive === true) await this.assertPlanLimit(tenantId, id);
    await this.prisma.professional.update({ where: { id }, data });
    if (serviceIds) await this.setServices(tenantId, id, serviceIds);
    let generatedPassword: string | undefined;
    if (createAccess) generatedPassword = await this.createAccess(tenantId, id, password);
    return { ...(await this.get(tenantId, id)), generatedPassword };
  }

  async remove(tenantId: string, id: string) {
    const pro = await this.get(tenantId, id);
    const future = await this.prisma.appointment.count({
      where: { professionalId: id, startAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    });
    if (future > 0) {
      throw new BadRequestException(`Este profissional tem ${future} agendamento(s) futuro(s). Cancele ou transfira antes de remover.`);
    }
    await this.prisma.professional.update({ where: { id }, data: { isActive: false, deletedAt: new Date(), membershipId: null } });
    if (pro.membershipId) {
      await this.prisma.membership.update({ where: { id: pro.membershipId }, data: { isActive: false } });
    }
    return { ok: true };
  }

  async setServices(tenantId: string, professionalId: string, serviceIds: string[]) {
    const valid = await this.prisma.service.findMany({ where: { tenantId, id: { in: serviceIds } }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.serviceProfessional.deleteMany({ where: { professionalId } }),
      this.prisma.serviceProfessional.createMany({ data: valid.map((s) => ({ serviceId: s.id, professionalId })) }),
    ]);
    return valid.map((s) => s.id);
  }

  // ---------------- acesso de login ----------------
  private async createAccess(tenantId: string, professionalId: string, password?: string): Promise<string | undefined> {
    const pro = await this.prisma.professional.findUniqueOrThrow({ where: { id: professionalId } });
    if (pro.membershipId) throw new ConflictException('Este profissional já tem acesso');
    if (!pro.email) throw new BadRequestException('Informe o e-mail do profissional para criar o acesso');
    let user = await this.prisma.user.findUnique({ where: { email: pro.email } });
    let generated: string | undefined;
    if (!user) {
      generated = password ?? randomToken(10);
      user = await this.prisma.user.create({
        data: { email: pro.email, name: pro.name, phone: pro.phone, password: await bcrypt.hash(generated, 10) },
      });
    }
    const existing = await this.prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId: user.id } } });
    const membership =
      existing ??
      (await this.prisma.membership.create({ data: { tenantId, userId: user.id, role: MemberRole.PROFESSIONAL } }));
    await this.prisma.professional.update({ where: { id: professionalId }, data: { membershipId: membership.id } });
    return generated;
  }

  // ---------------- jornada ----------------
  async setWorkSchedule(tenantId: string, id: string, actor: AuthUser, dto: SetWorkScheduleDto) {
    await this.assertCanManage(tenantId, id, actor);
    for (const r of dto.ranges) {
      if (timeToMinutes(r.startTime) >= timeToMinutes(r.endTime)) {
        throw new BadRequestException(`Intervalo inválido no dia ${r.weekday}: ${r.startTime}-${r.endTime}`);
      }
    }
    await this.prisma.$transaction([
      this.prisma.workSchedule.deleteMany({ where: { professionalId: id } }),
      this.prisma.workSchedule.createMany({ data: dto.ranges.map((r) => ({ professionalId: id, ...r })) }),
    ]);
    return this.prisma.workSchedule.findMany({ where: { professionalId: id }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
  }

  async listOverrides(tenantId: string, id: string, from?: string, to?: string) {
    await this.get(tenantId, id);
    return this.prisma.scheduleOverride.findMany({
      where: {
        professionalId: id,
        date: { gte: from ? parseDateOnly(from) : undefined, lte: to ? parseDateOnly(to) : undefined },
      },
      orderBy: { date: 'asc' },
    });
  }

  async createOverride(tenantId: string, id: string, actor: AuthUser, dto: CreateOverrideDto) {
    await this.assertCanManage(tenantId, id, actor);
    if (dto.type === 'EXTRA' && (!dto.startTime || !dto.endTime)) {
      throw new BadRequestException('Informe o horário da jornada específica');
    }
    const date = parseDateOnly(dto.date.slice(0, 10));
    // substitui registro do mesmo dia
    await this.prisma.scheduleOverride.deleteMany({ where: { professionalId: id, date } });
    return this.prisma.scheduleOverride.create({
      data: { professionalId: id, date, type: dto.type, startTime: dto.startTime, endTime: dto.endTime, reason: dto.reason },
    });
  }

  async removeOverride(tenantId: string, id: string, actor: AuthUser, overrideId: string) {
    await this.assertCanManage(tenantId, id, actor);
    await this.prisma.scheduleOverride.deleteMany({ where: { id: overrideId, professionalId: id } });
    return { ok: true };
  }

  // ---------------- bloqueios ----------------
  listBlocks(tenantId: string, from: Date, to: Date, professionalId?: string) {
    return this.prisma.scheduleBlock.findMany({
      where: {
        tenantId,
        startAt: { lt: to },
        endAt: { gt: from },
        ...(professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {}),
      },
      include: { professional: { select: { id: true, name: true, color: true } } },
      orderBy: { startAt: 'asc' },
    });
  }

  async createBlock(tenantId: string, actor: AuthUser, dto: CreateBlockDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (!(startAt < endAt)) throw new BadRequestException('Período inválido');
    if (actor.role === MemberRole.PROFESSIONAL) {
      if (!dto.professionalId || dto.professionalId !== actor.professionalId) {
        throw new ForbiddenException('Você só pode bloquear a própria agenda');
      }
    }
    if (dto.professionalId) await this.get(tenantId, dto.professionalId);
    return this.prisma.scheduleBlock.create({
      data: { tenantId, professionalId: dto.professionalId ?? null, startAt, endAt, reason: dto.reason },
    });
  }

  async removeBlock(tenantId: string, actor: AuthUser, blockId: string) {
    const b = await this.prisma.scheduleBlock.findFirst({ where: { id: blockId, tenantId } });
    if (!b) throw new NotFoundException('Bloqueio não encontrado');
    if (actor.role === MemberRole.PROFESSIONAL && b.professionalId !== actor.professionalId) {
      throw new ForbiddenException('Você só pode remover bloqueios da própria agenda');
    }
    await this.prisma.scheduleBlock.delete({ where: { id: blockId } });
    return { ok: true };
  }

  // ---------------- helpers ----------------
  private async assertCanManage(tenantId: string, professionalId: string, actor: AuthUser) {
    await this.get(tenantId, professionalId);
    if (actor.role === MemberRole.PROFESSIONAL && actor.professionalId !== professionalId) {
      throw new ForbiddenException('Você só pode alterar a própria jornada');
    }
  }

  private async assertPlanLimit(tenantId: string, ignoreId?: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const plan = PLANS.find((p) => p.code === t.planCode);
    const limit = Math.min(t.maxProfessionals, plan?.maxProfessionals ?? 999);
    const active = await this.prisma.professional.count({
      where: { tenantId, isActive: true, deletedAt: null, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    });
    if (active >= limit) {
      throw new BadRequestException(`Seu plano permite até ${limit} profissional(is) ativo(s). Faça upgrade para adicionar mais.`);
    }
  }
}

const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
export function pickColor(i: number) {
  return PALETTE[i % PALETTE.length];
}
