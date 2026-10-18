import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { normalizePhone, paged, paging, parseDateOnly } from '../../common/utils';
import { CreateClientDto, UpdateClientDto } from './clients.dto';

export interface ClientListQuery {
  search?: string;
  page?: string;
  limit?: string;
  tag?: string;
  clubId?: string;
  birthdayMonth?: string;
  inactiveDays?: string; // sem visita há X dias
  sort?: 'name' | 'lastVisit' | 'totalSpent' | 'createdAt';
}

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, q: ClientListQuery) {
    const p = paging(q, 30);
    const where: Prisma.ClientWhereInput = { tenantId, deletedAt: null };
    if (q.search) {
      const s = q.search.trim();
      const digits = s.replace(/\D/g, '');
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ];
    }
    if (q.tag) where.tags = { has: q.tag };
    if (q.clubId) where.clubId = q.clubId;
    if (q.inactiveDays) {
      const d = new Date(Date.now() - Number(q.inactiveDays) * 86400000);
      where.OR = [{ lastVisitAt: { lt: d } }, { lastVisitAt: null }];
    }
    let ids: string[] | undefined;
    if (q.birthdayMonth) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM clients WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
        AND "birthDate" IS NOT NULL AND EXTRACT(MONTH FROM "birthDate") = ${Number(q.birthdayMonth)}`;
      ids = rows.map((r) => r.id);
      where.id = { in: ids };
    }
    const orderBy: Prisma.ClientOrderByWithRelationInput =
      q.sort === 'lastVisit' ? { lastVisitAt: 'desc' } : q.sort === 'totalSpent' ? { totalSpent: 'desc' } : q.sort === 'createdAt' ? { createdAt: 'desc' } : { name: 'asc' };
    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy,
        skip: p.skip,
        take: p.take,
        include: { preferredProfessional: { select: { id: true, name: true } }, club: { select: { id: true, name: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        preferredProfessional: { select: { id: true, name: true } },
        club: true,
        packages: { where: { isActive: true }, include: { package: true, items: { include: { service: true, product: true } } } },
      },
    });
    if (!c) throw new NotFoundException('Cliente não encontrado');
    return c;
  }

  async history(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const [appointments, orders, loyalty, messages] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId, clientId: id },
        include: { professional: { select: { id: true, name: true, color: true } }, services: { include: { service: { select: { name: true } } } } },
        orderBy: { startAt: 'desc' },
        take: 100,
      }),
      this.prisma.order.findMany({
        where: { tenantId, clientId: id, status: { not: 'CANCELLED' } },
        include: { items: true, payments: true },
        orderBy: { openedAt: 'desc' },
        take: 100,
      }),
      this.prisma.loyaltyTransaction.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.messageLog.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { appointments, orders, loyalty, messages };
  }

  async create(tenantId: string, dto: CreateClientDto, source = 'ADMIN') {
    const phone = normalizePhone(dto.phone);
    if (phone) {
      const dup = await this.prisma.client.findFirst({ where: { tenantId, phone, deletedAt: null } });
      if (dup) throw new BadRequestException(`Já existe um cliente com este telefone: ${dup.name}`);
    }
    return this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        phone,
        email: dto.email?.toLowerCase().trim(),
        birthDate: dto.birthDate ? parseDateOnly(dto.birthDate.slice(0, 10)) : null,
        gender: dto.gender,
        document: dto.document,
        notes: dto.notes,
        avatarUrl: dto.avatarUrl,
        tags: dto.tags ?? [],
        preferredProfessionalId: dto.preferredProfessionalId ?? null,
        clubId: dto.clubId ?? null,
        clubSince: dto.clubId ? new Date() : null,
        blocked: dto.blocked ?? false,
        marketingOptIn: dto.marketingOptIn ?? true,
        source,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    const current = await this.get(tenantId, id);
    const data: Prisma.ClientUpdateInput = { ...(dto as any) };
    if (dto.phone !== undefined) {
      const phone = normalizePhone(dto.phone);
      if (phone) {
        const dup = await this.prisma.client.findFirst({ where: { tenantId, phone, deletedAt: null, NOT: { id } } });
        if (dup) throw new BadRequestException(`Já existe um cliente com este telefone: ${dup.name}`);
      }
      data.phone = phone;
    }
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase().trim() || null;
    if (dto.name) data.name = dto.name.trim();
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? parseDateOnly(dto.birthDate.slice(0, 10)) : null;
    if (dto.preferredProfessionalId !== undefined) {
      delete (data as any).preferredProfessionalId;
      data.preferredProfessional = dto.preferredProfessionalId ? { connect: { id: dto.preferredProfessionalId } } : { disconnect: true };
    }
    if (dto.clubId !== undefined) {
      delete (data as any).clubId;
      data.club = dto.clubId ? { connect: { id: dto.clubId } } : { disconnect: true };
      if (dto.clubId && dto.clubId !== current.clubId) data.clubSince = new Date();
      if (!dto.clubId) data.clubSince = null;
    }
    return this.prisma.client.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /** Aniversariantes do mês (ou do dia) */
  async birthdays(tenantId: string, month?: number, day?: number) {
    const m = month ?? new Date().getMonth() + 1;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, name, phone, email, "birthDate", "avatarUrl", "lastVisitAt"
      FROM clients
      WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${m}
        ${day ? Prisma.sql`AND EXTRACT(DAY FROM "birthDate") = ${day}` : Prisma.empty}
      ORDER BY EXTRACT(DAY FROM "birthDate"), name`;
    return rows;
  }

  async import(tenantId: string, items: CreateClientDto[]) {
    let created = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        await this.create(tenantId, item, 'IMPORT');
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped };
  }

  listTags(tenantId: string) {
    return this.prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT unnest(tags) AS tag, COUNT(*)::int AS count FROM clients
      WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL GROUP BY tag ORDER BY count DESC`;
  }

  /** Encontra ou cria cliente a partir de nome/telefone (agendamento online / comanda rápida) */
  async findOrCreateByPhone(tenantId: string, data: { name: string; phone?: string | null; email?: string | null; userId?: string | null }, source = 'SITE') {
    const phone = normalizePhone(data.phone);
    const email = data.email?.toLowerCase().trim() || null;
    let client = null as any;
    if (data.userId) client = await this.prisma.client.findFirst({ where: { tenantId, userId: data.userId, deletedAt: null } });
    if (!client && phone) client = await this.prisma.client.findFirst({ where: { tenantId, phone, deletedAt: null } });
    if (!client && email) client = await this.prisma.client.findFirst({ where: { tenantId, email, deletedAt: null } });
    if (client) {
      if (data.userId && !client.userId) {
        client = await this.prisma.client.update({ where: { id: client.id }, data: { userId: data.userId } });
      }
      return client;
    }
    return this.prisma.client.create({
      data: { tenantId, name: data.name.trim(), phone, email, userId: data.userId ?? null, source },
    });
  }
}
