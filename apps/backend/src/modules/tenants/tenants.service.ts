import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, PaymentMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone, randomToken, slugify } from '../../common/utils';
import { CreateMemberDto, PaymentMethodsDto, UpdateMemberDto, UpdateTenantDto } from './tenants.dto';
import { PLANS } from '../billing/plans';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async get(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const [professionals, services, clients] = await Promise.all([
      this.prisma.professional.count({ where: { tenantId, isActive: true, deletedAt: null } }),
      this.prisma.service.count({ where: { tenantId, isActive: true, deletedAt: null } }),
      this.prisma.client.count({ where: { tenantId, deletedAt: null } }),
    ]);
    return {
      ...t,
      counts: { professionals, services, clients },
      plan: this.planInfo(t),
      integrations: {
        creativePay: !!t.cpApiKey,
        creativePayLast4: t.cpApiKey ? t.cpApiKey.slice(-4) : null,
        creativePayWebhookSecret: !!t.cpWebhookSecret,
        pos: !!t.posAccessToken && !!t.posDeviceId,
        posDeviceId: t.posDeviceId,
        kioskToken: t.kioskToken,
      },
    };
  }

  /** Gera (ou renova) o token do totem de autoatendimento */
  async regenerateKioskToken(tenantId: string) {
    const kioskToken = randomToken(32);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { kioskToken, kioskEnabled: true } });
    return { kioskToken };
  }

  planInfo(t: { planCode: string; planStatus: string; trialEndsAt: Date | null; planRenewsAt: Date | null }) {
    const plan = PLANS.find((p) => p.code === t.planCode) ?? PLANS[0];
    const now = new Date();
    const trialDaysLeft = t.trialEndsAt ? Math.max(0, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86400000)) : null;
    const blocked =
      t.planStatus === 'BLOCKED' ||
      t.planStatus === 'CANCELLED' ||
      (t.planStatus === 'TRIAL' && t.trialEndsAt !== null && t.trialEndsAt < now);
    return { ...plan, status: t.planStatus, trialEndsAt: t.trialEndsAt, trialDaysLeft, renewsAt: t.planRenewsAt, blocked };
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    const data: any = { ...dto };
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      if (slug.length < 3) throw new BadRequestException('Endereço muito curto');
      const exists = await this.prisma.tenant.findFirst({ where: { slug, NOT: { id: tenantId } } });
      if (exists) throw new ConflictException('Este endereço já está em uso');
      data.slug = slug;
    }
    if (dto.phone !== undefined) data.phone = normalizePhone(dto.phone);
    if (dto.whatsapp !== undefined) data.whatsapp = normalizePhone(dto.whatsapp);
    if (dto.openingHours) data.openingHours = this.validateHours(dto.openingHours);
    return this.prisma.tenant.update({ where: { id: tenantId }, data });
  }

  private validateHours(h: Record<string, { start: string; end: string }[]>) {
    const out: Record<string, { start: string; end: string }[]> = {};
    for (let d = 0; d <= 6; d++) {
      const ranges = h[String(d)] ?? [];
      if (!Array.isArray(ranges)) throw new BadRequestException('Horário de funcionamento inválido');
      out[d] = ranges.map((r) => {
        if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end) || r.start >= r.end) {
          throw new BadRequestException(`Horário inválido no dia ${d}`);
        }
        return { start: r.start, end: r.end };
      });
    }
    return out;
  }

  // ---------------- Equipe (acessos) ----------------
  async listMembers(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true, lastLoginAt: true } },
        professional: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMember(tenantId: string, actor: AuthUser, dto: CreateMemberDto) {
    if (dto.role === MemberRole.OWNER && actor.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Somente o dono pode criar outro dono');
    }
    const email = dto.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email } });
    let generatedPassword: string | undefined;
    if (!user) {
      generatedPassword = dto.password ?? randomToken(10);
      user = await this.prisma.user.create({
        data: { email, name: dto.name.trim(), phone: normalizePhone(dto.phone), password: await bcrypt.hash(generatedPassword, 10) },
      });
    } else if (dto.password) {
      // usuário já existe em outra barbearia: não trocamos a senha dele
      generatedPassword = undefined;
    }
    const exists = await this.prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId: user.id } } });
    if (exists) throw new ConflictException('Esta pessoa já faz parte da equipe');

    const membership = await this.prisma.membership.create({
      data: { tenantId, userId: user.id, role: dto.role, permissions: dto.permissions ?? undefined },
    });
    if (dto.professionalId) {
      await this.linkProfessional(tenantId, membership.id, dto.professionalId);
    } else if (dto.role === MemberRole.PROFESSIONAL) {
      // cria o profissional automaticamente
      const count = await this.prisma.professional.count({ where: { tenantId } });
      const pro = await this.prisma.professional.create({
        data: { tenantId, membershipId: membership.id, name: user.name, phone: user.phone, email: user.email, displayOrder: count },
      });
      const { defaultWorkSchedule } = await import('../auth/auth.service');
      await this.prisma.workSchedule.createMany({ data: defaultWorkSchedule(pro.id) });
    }
    return { membership, generatedPassword, userExisted: !generatedPassword && !dto.password };
  }

  async updateMember(tenantId: string, actor: AuthUser, membershipId: string, dto: UpdateMemberDto) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId }, include: { user: true } });
    if (!m) throw new NotFoundException('Membro não encontrado');
    if (m.role === MemberRole.OWNER && actor.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Somente o dono pode alterar o dono');
    }
    if (dto.role === MemberRole.OWNER && actor.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Somente o dono pode promover a dono');
    }
    if (m.role === MemberRole.OWNER && (dto.isActive === false || (dto.role && dto.role !== MemberRole.OWNER))) {
      const owners = await this.prisma.membership.count({ where: { tenantId, role: MemberRole.OWNER, isActive: true } });
      if (owners <= 1) throw new BadRequestException('A barbearia precisa ter pelo menos um dono');
    }
    if (dto.password) {
      await this.prisma.user.update({ where: { id: m.userId }, data: { password: await bcrypt.hash(dto.password, 10) } });
      await this.prisma.refreshToken.updateMany({ where: { userId: m.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    if (dto.professionalId !== undefined) {
      if (dto.professionalId) await this.linkProfessional(tenantId, membershipId, dto.professionalId);
      else await this.prisma.professional.updateMany({ where: { membershipId }, data: { membershipId: null } });
    }
    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role, permissions: dto.permissions ?? undefined, isActive: dto.isActive },
      include: { user: { select: { id: true, name: true, email: true } }, professional: { select: { id: true, name: true } } },
    });
  }

  async removeMember(tenantId: string, actor: AuthUser, membershipId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId } });
    if (!m) throw new NotFoundException('Membro não encontrado');
    if (m.userId === actor.sub) throw new BadRequestException('Você não pode remover o próprio acesso');
    if (m.role === MemberRole.OWNER) throw new BadRequestException('Transfira a propriedade antes de remover o dono');
    await this.prisma.professional.updateMany({ where: { membershipId }, data: { membershipId: null } });
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.prisma.refreshToken.updateMany({ where: { userId: m.userId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  private async linkProfessional(tenantId: string, membershipId: string, professionalId: string) {
    const pro = await this.prisma.professional.findFirst({ where: { id: professionalId, tenantId } });
    if (!pro) throw new NotFoundException('Profissional não encontrado');
    if (pro.membershipId && pro.membershipId !== membershipId) {
      throw new ConflictException('Este profissional já está vinculado a outro acesso');
    }
    await this.prisma.professional.updateMany({ where: { membershipId, NOT: { id: professionalId } }, data: { membershipId: null } });
    await this.prisma.professional.update({ where: { id: professionalId }, data: { membershipId } });
  }

  // ---------------- Formas de pagamento ----------------
  listPaymentMethods(tenantId: string) {
    return this.prisma.paymentMethodConfig.findMany({ where: { tenantId }, orderBy: { method: 'asc' } });
  }

  async savePaymentMethods(tenantId: string, dto: PaymentMethodsDto) {
    for (const item of dto.items) {
      if (!Object.values(PaymentMethod).includes(item.method as PaymentMethod)) {
        throw new BadRequestException(`Forma de pagamento inválida: ${item.method}`);
      }
      await this.prisma.paymentMethodConfig.upsert({
        where: { tenantId_method: { tenantId, method: item.method as PaymentMethod } },
        update: {
          label: item.label,
          feePct: item.feePct,
          installmentFees: item.installmentFees ?? undefined,
          maxInstallments: item.maxInstallments,
          isActive: item.isActive,
        },
        create: {
          tenantId,
          method: item.method as PaymentMethod,
          label: item.label,
          feePct: item.feePct ?? 0,
          installmentFees: item.installmentFees ?? undefined,
          maxInstallments: item.maxInstallments ?? 1,
          isActive: item.isActive ?? true,
        },
      });
    }
    return this.listPaymentMethods(tenantId);
  }
}
