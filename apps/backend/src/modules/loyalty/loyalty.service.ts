import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AdjustPointsDto, ClubDto, LoyaltyProgramDto, LoyaltyRewardDto, PackageDto } from './loyalty.dto';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  // ---------------- programa ----------------
  async getProgram(tenantId: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId }, include: { rewards: { orderBy: { pointsCost: 'asc' }, include: { service: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } } } } });
    if (program) return program;
    return this.prisma.loyaltyProgram.create({ data: { tenantId }, include: { rewards: true } });
  }

  async updateProgram(tenantId: string, dto: LoyaltyProgramDto) {
    await this.getProgram(tenantId);
    return this.prisma.loyaltyProgram.update({ where: { tenantId }, data: dto, include: { rewards: true } });
  }

  async createReward(tenantId: string, dto: LoyaltyRewardDto) {
    const program = await this.getProgram(tenantId);
    return this.prisma.loyaltyReward.create({ data: { programId: program.id, ...dto } });
  }

  async updateReward(tenantId: string, id: string, dto: LoyaltyRewardDto) {
    const program = await this.getProgram(tenantId);
    const r = await this.prisma.loyaltyReward.findFirst({ where: { id, programId: program.id } });
    if (!r) throw new NotFoundException('Prêmio não encontrado');
    return this.prisma.loyaltyReward.update({ where: { id }, data: dto });
  }

  async removeReward(tenantId: string, id: string) {
    const program = await this.getProgram(tenantId);
    await this.prisma.loyaltyReward.deleteMany({ where: { id, programId: program.id } });
    return { ok: true };
  }

  async adjust(tenantId: string, clientId: string, dto: AdjustPointsDto) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.loyaltyPoints + dto.points < 0) throw new BadRequestException('Saldo de pontos insuficiente');
    const c = await this.prisma.client.update({ where: { id: clientId }, data: { loyaltyPoints: { increment: dto.points } } });
    return this.prisma.loyaltyTransaction.create({ data: { tenantId, clientId, type: 'ADJUST', points: dto.points, balanceAfter: c.loyaltyPoints, description: dto.description ?? 'Ajuste manual' } });
  }

  /** Resgate de prêmio (feito pela barbearia ou solicitado pelo cliente no app) */
  async redeem(tenantId: string, clientId: string, rewardId: string, requested = false) {
    const program = await this.getProgram(tenantId);
    if (!program.isActive) throw new BadRequestException('Programa de fidelidade inativo');
    const reward = program.rewards.find((r) => r.id === rewardId && r.isActive);
    if (!reward) throw new NotFoundException('Prêmio não encontrado');
    const client = await this.prisma.client.findFirst({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.loyaltyPoints < reward.pointsCost) throw new BadRequestException(`Pontos insuficientes (${client.loyaltyPoints}/${reward.pointsCost})`);
    const c = await this.prisma.client.update({ where: { id: clientId }, data: { loyaltyPoints: { decrement: reward.pointsCost } } });
    return this.prisma.loyaltyTransaction.create({
      data: { tenantId, clientId, type: 'REDEEM', points: -reward.pointsCost, balanceAfter: c.loyaltyPoints, rewardId, description: `Resgate: ${reward.name}`, status: requested ? 'REQUESTED' : 'DONE' },
    });
  }

  async confirmRedeem(tenantId: string, txId: string) {
    const tx = await this.prisma.loyaltyTransaction.findFirst({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException('Resgate não encontrado');
    return this.prisma.loyaltyTransaction.update({ where: { id: txId }, data: { status: 'DONE' } });
  }

  async cancelRedeem(tenantId: string, txId: string) {
    const tx = await this.prisma.loyaltyTransaction.findFirst({ where: { id: txId, tenantId, type: 'REDEEM' } });
    if (!tx) throw new NotFoundException('Resgate não encontrado');
    const c = await this.prisma.client.update({ where: { id: tx.clientId }, data: { loyaltyPoints: { increment: -tx.points } } });
    await this.prisma.loyaltyTransaction.create({ data: { tenantId, clientId: tx.clientId, type: 'ADJUST', points: -tx.points, balanceAfter: c.loyaltyPoints, description: 'Resgate cancelado' } });
    return this.prisma.loyaltyTransaction.update({ where: { id: txId }, data: { status: 'CANCELLED' } });
  }

  transactions(tenantId: string, q: { clientId?: string; status?: string; limit?: string }) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { tenantId, ...(q.clientId ? { clientId: q.clientId } : {}), ...(q.status ? { status: q.status } : {}) },
      include: { client: { select: { id: true, name: true, phone: true } }, reward: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Number(q.limit) || 100),
    });
  }

  async ranking(tenantId: string) {
    return this.prisma.client.findMany({ where: { tenantId, deletedAt: null, loyaltyPoints: { gt: 0 } }, select: { id: true, name: true, phone: true, loyaltyPoints: true, visitsCount: true }, orderBy: { loyaltyPoints: 'desc' }, take: 50 });
  }

  // ---------------- pacotes ----------------
  listPackages(tenantId: string, includeInactive = false) {
    return this.prisma.package.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      include: { items: { include: { service: { select: { id: true, name: true, price: true } }, product: { select: { id: true, name: true, salePrice: true } } } }, _count: { select: { clientPackages: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPackage(tenantId: string, dto: PackageDto) {
    this.validateItems(dto);
    const { items, ...rest } = dto;
    return this.prisma.package.create({ data: { tenantId, ...rest, items: { create: items } }, include: { items: true } });
  }

  async updatePackage(tenantId: string, id: string, dto: PackageDto) {
    const p = await this.prisma.package.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Pacote não encontrado');
    this.validateItems(dto);
    const { items, ...rest } = dto;
    return this.prisma.package.update({ where: { id }, data: { ...rest, items: { deleteMany: {}, create: items } }, include: { items: true } });
  }

  async removePackage(tenantId: string, id: string) {
    const p = await this.prisma.package.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Pacote não encontrado');
    await this.prisma.package.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  private validateItems(dto: PackageDto) {
    if (!dto.items?.length) throw new BadRequestException('Pacote precisa de pelo menos um item');
    for (const i of dto.items) if (!i.serviceId && !i.productId) throw new BadRequestException('Item do pacote precisa de serviço ou produto');
  }

  clientPackages(tenantId: string, clientId?: string, activeOnly = true) {
    return this.prisma.clientPackage.findMany({
      where: { tenantId, ...(clientId ? { clientId } : {}), ...(activeOnly ? { isActive: true } : {}) },
      include: { client: { select: { id: true, name: true } }, package: { select: { id: true, name: true } }, items: { include: { service: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } } } },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  // ---------------- clubes ----------------
  listClubs(tenantId: string) {
    return this.prisma.clientClub.findMany({ where: { tenantId }, include: { _count: { select: { clients: true } } }, orderBy: { name: 'asc' } });
  }
  createClub(tenantId: string, dto: ClubDto) {
    return this.prisma.clientClub.create({ data: { tenantId, ...dto } });
  }
  async updateClub(tenantId: string, id: string, dto: ClubDto) {
    const c = await this.prisma.clientClub.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Clube não encontrado');
    return this.prisma.clientClub.update({ where: { id }, data: dto });
  }
  async removeClub(tenantId: string, id: string) {
    const c = await this.prisma.clientClub.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Clube não encontrado');
    await this.prisma.client.updateMany({ where: { clubId: id }, data: { clubId: null, clubSince: null } });
    await this.prisma.clientClub.delete({ where: { id } });
    return { ok: true };
  }
}
