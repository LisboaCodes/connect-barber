import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MemberRole, Membership, PaymentMethod, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { addDays } from 'date-fns';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone, randomToken, sha256, slugify } from '../../common/utils';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterClientDto,
  RegisterTenantDto,
  UpdateProfileDto,
} from './auth.dto';
import { MessagingService } from '../messaging/messaging.service';

const TRIAL_DAYS = 30;
const REFRESH_DAYS = 30;

type MembershipWithTenant = Membership & {
  tenant: { id: string; name: string; slug: string; logoUrl: string | null; planStatus: string; onboardingStep: number };
  professional: { id: string } | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private messaging: MessagingService,
  ) {}

  // ------------------------------------------------------------------
  // Cadastro da barbearia (dono)
  // ------------------------------------------------------------------
  async registerTenant(dto: RegisterTenantDto, meta?: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail');

    const slug = await this.uniqueSlug(dto.tenantName);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const ownerIsProfessional = dto.ownerIsProfessional ?? true;

    const { user, membership } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          phone: normalizePhone(dto.phone),
          password: passwordHash,
        },
      });
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName.trim(),
          slug,
          email,
          phone: normalizePhone(dto.phone),
          whatsapp: normalizePhone(dto.phone),
          addressCity: dto.city,
          addressState: dto.state,
          trialEndsAt: addDays(new Date(), TRIAL_DAYS),
          openingHours: defaultOpeningHours(),
          reminderChannels: ['WHATSAPP', 'EMAIL'],
          onboardingStep: 1,
        },
      });
      const membership = await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: MemberRole.OWNER },
      });
      if (ownerIsProfessional) {
        const professional = await tx.professional.create({
          data: {
            tenantId: tenant.id,
            membershipId: membership.id,
            name: user.name,
            phone: user.phone,
            email,
            displayOrder: 0,
          },
        });
        await tx.workSchedule.createMany({
          data: defaultWorkSchedule(professional.id),
        });
      }
      await this.provisionTenantDefaults(tx, tenant.id);
      return { user, membership };
    });

    this.logger.log(`Nova barbearia cadastrada: ${slug} (${email})`);
    this.messaging
      .sendWelcomeEmail(email, dto.name, dto.tenantName)
      .catch((e) => this.logger.warn(`Falha ao enviar boas-vindas: ${e.message}`));

    return this.issueSession(user, membership.tenantId, meta);
  }

  // ------------------------------------------------------------------
  // Cadastro de cliente final
  // ------------------------------------------------------------------
  async registerClient(dto: RegisterClientDto, meta?: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail');
    const phone = normalizePhone(dto.phone);
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), phone, password: await bcrypt.hash(dto.password, 10) },
    });
    // vincula cadastros de cliente já existentes (mesmo telefone ou e-mail)
    await this.prisma.client.updateMany({
      where: { userId: null, OR: [{ email }, ...(phone ? [{ phone }] : [])] },
      data: { userId: user.id },
    });
    return this.issueSession(user, undefined, meta);
  }

  // ------------------------------------------------------------------
  // Login / sessão
  // ------------------------------------------------------------------
  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || user.deletedAt) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('E-mail ou senha inválidos');

    const memberships = await this.activeMemberships(user.id);
    let tenantId: string | undefined;
    if (dto.tenantId) {
      if (!memberships.some((m) => m.tenantId === dto.tenantId)) {
        throw new UnauthorizedException('Você não tem acesso a esta barbearia');
      }
      tenantId = dto.tenantId;
    } else if (memberships.length >= 1) {
      tenantId = memberships[0].tenantId;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueSession(user, tenantId, meta, memberships);
  }

  async switchTenant(userId: string, tenantId: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.activeMemberships(userId);
    if (!memberships.some((m) => m.tenantId === tenantId)) {
      throw new UnauthorizedException('Você não tem acesso a esta barbearia');
    }
    return this.issueSession(user, tenantId, meta, memberships);
  }

  async refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }) {
    const hash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada, entre novamente');
    }
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Conta inativa');
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const memberships = await this.activeMemberships(user.id);
    let tenantId = stored.tenantId ?? undefined;
    if (tenantId && !memberships.some((m) => m.tenantId === tenantId)) tenantId = memberships[0]?.tenantId;
    return this.issueSession(user, tenantId, meta, memberships);
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.sub } });
    const memberships = await this.activeMemberships(user.id);
    const current = memberships.find((m) => m.tenantId === auth.tenantId);
    const clients = await this.prisma.client.count({ where: { userId: user.id } });
    return {
      user: this.publicUser(user),
      memberships: memberships.map(this.publicMembership),
      current: current ? this.publicMembership(current) : null,
      isClient: clients > 0 || memberships.length === 0,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone !== undefined ? normalizePhone(dto.phone) : undefined,
        avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl,
      },
    });
    // mantém o cadastro de profissional em sincronia
    if (dto.name || dto.phone || dto.avatarUrl !== undefined) {
      const memberships = await this.prisma.membership.findMany({ where: { userId }, include: { professional: true } });
      for (const m of memberships) {
        if (m.professional) {
          await this.prisma.professional.update({
            where: { id: m.professional.id },
            data: { name: user.name, phone: user.phone, avatarUrl: user.avatarUrl },
          });
        }
      }
    }
    return this.publicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.password || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(dto.newPassword, 10) } });
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      const token = randomToken(40);
      await this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: addDays(new Date(), 1) },
      });
      const url = `${this.config.get('FRONTEND_URL', 'http://localhost:5173').split(',')[0]}/redefinir-senha?token=${token}`;
      this.messaging
        .sendPasswordResetEmail(user.email, user.name, url)
        .catch((e) => this.logger.warn(`Falha ao enviar reset: ${e.message}`));
    }
    return { ok: true, message: 'Se o e-mail existir, enviaremos as instruções' };
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Link inválido ou expirado');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { password: await bcrypt.hash(password, 10) } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------------
  private async issueSession(
    user: User,
    tenantId: string | undefined,
    meta?: { ip?: string; userAgent?: string },
    memberships?: MembershipWithTenant[],
  ) {
    memberships = memberships ?? (await this.activeMemberships(user.id));
    const current = tenantId ? memberships.find((m) => m.tenantId === tenantId) : undefined;

    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: current?.tenantId,
      membershipId: current?.id,
      role: current?.role,
      professionalId: current?.professional?.id,
      permissions: (current?.permissions as Record<string, boolean>) ?? undefined,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        tenantId: current?.tenantId,
        expiresAt: addDays(new Date(), REFRESH_DAYS),
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 250),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: this.publicUser(user),
      memberships: memberships.map(this.publicMembership),
      current: current ? this.publicMembership(current) : null,
    };
  }

  private activeMemberships(userId: string): Promise<MembershipWithTenant[]> {
    return this.prisma.membership.findMany({
      where: { userId, isActive: true, tenant: { deletedAt: null, isActive: true } },
      include: {
        tenant: { select: { id: true, name: true, slug: true, logoUrl: true, planStatus: true, onboardingStep: true } },
        professional: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  private publicUser(u: User) {
    return { id: u.id, email: u.email, name: u.name, phone: u.phone, avatarUrl: u.avatarUrl, isSuperAdmin: u.isSuperAdmin };
  }

  private publicMembership = (m: MembershipWithTenant) => ({
    id: m.id,
    tenantId: m.tenantId,
    role: m.role,
    professionalId: m.professional?.id ?? null,
    permissions: m.permissions,
    tenant: m.tenant,
  });

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'barbearia';
    let slug = base;
    for (let i = 2; i < 1000; i++) {
      const exists = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${i}`;
    }
    throw new ConflictException('Não foi possível gerar o endereço da barbearia');
  }

  /** Dados iniciais da barbearia: categorias financeiras e formas de pagamento */
  private async provisionTenantDefaults(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.financeCategory.createMany({
      data: [
        { tenantId, name: 'Serviços', type: 'INCOME', isSystem: true },
        { tenantId, name: 'Produtos', type: 'INCOME', isSystem: true },
        { tenantId, name: 'Pacotes e clube', type: 'INCOME', isSystem: true },
        { tenantId, name: 'Outras receitas', type: 'INCOME', isSystem: true },
        { tenantId, name: 'Aluguel', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Água, luz e internet', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Fornecedores', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Comissões', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Impostos e taxas', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Marketing', type: 'EXPENSE', isSystem: true },
        { tenantId, name: 'Outras despesas', type: 'EXPENSE', isSystem: true },
      ],
    });
    const methods: { method: PaymentMethod; label: string; feePct: number; max: number }[] = [
      { method: 'CASH', label: 'Dinheiro', feePct: 0, max: 1 },
      { method: 'PIX', label: 'Pix', feePct: 0, max: 1 },
      { method: 'DEBIT_CARD', label: 'Cartão de débito', feePct: 1.5, max: 1 },
      { method: 'CREDIT_CARD', label: 'Cartão de crédito', feePct: 3.5, max: 12 },
      { method: 'TRANSFER', label: 'Transferência', feePct: 0, max: 1 },
    ];
    await tx.paymentMethodConfig.createMany({
      data: methods.map((m) => ({ tenantId, method: m.method, label: m.label, feePct: m.feePct, maxInstallments: m.max })),
    });
  }
}

export function defaultOpeningHours() {
  const week: Record<string, { start: string; end: string }[]> = {};
  for (let d = 1; d <= 5; d++) week[d] = [{ start: '09:00', end: '19:00' }];
  week[6] = [{ start: '09:00', end: '17:00' }];
  week[0] = [];
  return week;
}

export function defaultWorkSchedule(professionalId: string) {
  const rows: { professionalId: string; weekday: number; startTime: string; endTime: string }[] = [];
  for (let d = 1; d <= 5; d++) {
    rows.push({ professionalId, weekday: d, startTime: '09:00', endTime: '12:00' });
    rows.push({ professionalId, weekday: d, startTime: '13:00', endTime: '19:00' });
  }
  rows.push({ professionalId, weekday: 6, startTime: '09:00', endTime: '17:00' });
  return rows;
}
