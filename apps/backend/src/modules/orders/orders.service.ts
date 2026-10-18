import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MemberRole, Order, OrderStatus, PaymentMethod, Prisma, Tenant } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { localDayRange, money, normalizePhone, pct, toLocalDate } from '../../common/utils';
import { ClientsService } from '../clients/clients.service';
import { AddItemDto, CloseOrderDto, DiscountDto, OpenOrderDto, PaymentDto, UpdateItemDto } from './orders.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService, private clients: ClientsService) {}

  readonly include = {
    client: { select: { id: true, name: true, phone: true, email: true, loyaltyPoints: true, clubId: true, club: { select: { id: true, name: true, discountPct: true, appliesToServices: true, appliesToProducts: true } } } },
    professional: { select: { id: true, name: true, color: true } },
    items: {
      include: { service: { select: { id: true, name: true } }, product: { select: { id: true, name: true } }, professional: { select: { id: true, name: true } }, package: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
    payments: { orderBy: { createdAt: 'asc' as const } },
    appointment: { select: { id: true, startAt: true, status: true } },
  };

  // ------------------------------------------------------------------
  async list(tenantId: string, actor: AuthUser, q: { status?: string; date?: string; from?: string; to?: string; clientId?: string; professionalId?: string; kind?: string; page?: string; limit?: string; search?: string }) {
    const tenant = await this.tenant(tenantId);
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Number(q.limit) || 50);
    const where: Prisma.OrderWhereInput = { tenantId };
    if (q.status) where.status = { in: q.status.split(',') as OrderStatus[] };
    if (q.kind) where.kind = q.kind as any;
    if (q.clientId) where.clientId = q.clientId;
    if (actor.role === MemberRole.PROFESSIONAL) where.OR = [{ professionalId: actor.professionalId }, { items: { some: { professionalId: actor.professionalId } } }];
    else if (q.professionalId) where.professionalId = q.professionalId;
    if (q.date) {
      const r = localDayRange(q.date, tenant.timezone);
      where.openedAt = { gte: r.start, lte: r.end };
    } else if (q.from || q.to) {
      where.openedAt = {
        ...(q.from ? { gte: localDayRange(q.from, tenant.timezone).start } : {}),
        ...(q.to ? { lte: localDayRange(q.to, tenant.timezone).end } : {}),
      };
    }
    if (q.search) {
      const n = Number(q.search);
      where.OR = [
        ...(Number.isFinite(n) ? [{ number: n }] : []),
        { client: { name: { contains: q.search, mode: 'insensitive' as const } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, include: this.include, orderBy: { openedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(tenantId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, tenantId }, include: this.include });
    if (!o) throw new NotFoundException('Comanda não encontrada');
    return o;
  }

  // ------------------------------------------------------------------
  async open(tenantId: string, actor: AuthUser, dto: OpenOrderDto) {
    const tenant = await this.tenant(tenantId);
    let clientId = dto.clientId ?? null;
    let professionalId = dto.professionalId ?? null;
    let appointment: any = null;

    if (dto.appointmentId) {
      appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId, deletedAt: null },
        include: { services: { include: { service: true } }, order: true },
      });
      if (!appointment) throw new NotFoundException('Agendamento não encontrado');
      if (appointment.orderId) return this.get(tenantId, appointment.orderId);
      if (appointment.status === 'CANCELLED') throw new BadRequestException('Agendamento cancelado');
      clientId = clientId ?? appointment.clientId;
      professionalId = professionalId ?? appointment.professionalId;
      if (!clientId && appointment.guestName) {
        const c = await this.clients.findOrCreateByPhone(tenantId, { name: appointment.guestName, phone: appointment.guestPhone }, 'ADMIN');
        clientId = c.id;
        await this.prisma.appointment.update({ where: { id: appointment.id }, data: { clientId } });
      }
    }
    if (!clientId && dto.clientName) {
      const c = await this.clients.findOrCreateByPhone(tenantId, { name: dto.clientName, phone: dto.clientPhone }, 'ADMIN');
      clientId = c.id;
    }
    if (dto.kind === 'PROFESSIONAL_CONSUMPTION' && !professionalId) throw new BadRequestException('Informe o profissional');
    if (actor.role === MemberRole.PROFESSIONAL) professionalId = actor.professionalId ?? professionalId;

    const order = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.update({ where: { id: tenantId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
      const o = await tx.order.create({
        data: { tenantId, number: t.orderSeq, kind: dto.kind ?? 'CLIENT', clientId, professionalId, notes: dto.notes, createdById: actor.sub },
      });
      if (appointment) {
        await tx.appointment.update({ where: { id: appointment.id }, data: { orderId: o.id, ...(appointment.status !== 'COMPLETED' && appointment.status !== 'IN_PROGRESS' ? { status: 'IN_PROGRESS', startedAt: new Date() } : {}) } });
      }
      return o;
    });

    if (appointment) {
      for (const s of appointment.services) {
        await this.addItem(tenantId, actor, order.id, { type: 'SERVICE', serviceId: s.serviceId, professionalId: appointment.professionalId, unitPrice: Number(s.price) }, tenant);
      }
    }
    return this.get(tenantId, order.id);
  }

  async addItem(tenantId: string, actor: AuthUser, orderId: string, dto: AddItemDto, tenant?: Tenant) {
    tenant = tenant ?? (await this.tenant(tenantId));
    const order = await this.assertOpen(tenantId, orderId, actor);
    const qty = dto.quantity ?? 1;
    let description = dto.description ?? '';
    let unitPrice = dto.unitPrice;
    let commissionPct: number | null = dto.commissionPct ?? null;
    let professionalId = dto.professionalId ?? order.professionalId ?? null;
    if (actor.role === MemberRole.PROFESSIONAL) professionalId = actor.professionalId ?? professionalId;
    const pro = professionalId ? await this.prisma.professional.findFirst({ where: { id: professionalId, tenantId } }) : null;

    if (dto.type === 'SERVICE') {
      if (!dto.serviceId) throw new BadRequestException('Informe o serviço');
      const s = await this.prisma.service.findFirst({ where: { id: dto.serviceId, tenantId, deletedAt: null }, include: { professionals: professionalId ? { where: { professionalId } } : false } });
      if (!s) throw new NotFoundException('Serviço não encontrado');
      description = s.name;
      const custom = (s as any).professionals?.[0];
      unitPrice = unitPrice ?? Number(custom?.price ?? s.price);
      if (commissionPct === null) commissionPct = s.commissionPct !== null ? Number(s.commissionPct) : pro ? Number(pro.serviceCommissionPct) : 0;
    } else if (dto.type === 'PRODUCT') {
      if (!dto.productId) throw new BadRequestException('Informe o produto');
      const p = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId, deletedAt: null } });
      if (!p) throw new NotFoundException('Produto não encontrado');
      description = p.name;
      unitPrice = unitPrice ?? Number(p.salePrice);
      if (commissionPct === null) commissionPct = p.commissionPct !== null ? Number(p.commissionPct) : pro ? Number(pro.productCommissionPct) : 0;
    } else if (dto.type === 'PACKAGE') {
      if (!dto.packageId) throw new BadRequestException('Informe o pacote');
      const pk = await this.prisma.package.findFirst({ where: { id: dto.packageId, tenantId, isActive: true } });
      if (!pk) throw new NotFoundException('Pacote não encontrado');
      if (!order.clientId) throw new BadRequestException('Vincule um cliente para vender pacote');
      description = `Pacote: ${pk.name}`;
      unitPrice = unitPrice ?? Number(pk.price);
      commissionPct = commissionPct ?? 0;
    } else {
      if (!description) throw new BadRequestException('Informe a descrição');
      unitPrice = unitPrice ?? 0;
      commissionPct = commissionPct ?? 0;
    }

    // consumo de pacote: item sem custo
    if (dto.clientPackageItemId) {
      const cpi = await this.prisma.clientPackageItem.findFirst({ where: { id: dto.clientPackageItemId, clientPackage: { tenantId, clientId: order.clientId ?? '__' } }, include: { clientPackage: true } });
      if (!cpi) throw new NotFoundException('Sessão de pacote não encontrada para este cliente');
      if (cpi.usedQty + qty > cpi.totalQty) throw new BadRequestException('Pacote sem sessões suficientes');
      if (cpi.clientPackage.expiresAt && cpi.clientPackage.expiresAt < new Date()) throw new BadRequestException('Pacote vencido');
      unitPrice = 0;
      description = `${description} (pacote)`;
    }

    // clube de clientes: desconto automático
    let discountAmount = dto.discountAmount ?? 0;
    const club = order.client?.club;
    if (club && !dto.clientPackageItemId && discountAmount === 0 && Number(club.discountPct) > 0) {
      if ((dto.type === 'SERVICE' && club.appliesToServices) || (dto.type === 'PRODUCT' && club.appliesToProducts)) {
        discountAmount = pct(unitPrice! * qty, Number(club.discountPct));
      }
    }

    const total = money(unitPrice! * qty - discountAmount);
    const commissionAmount = pct(total, commissionPct ?? 0);
    await this.prisma.orderItem.create({
      data: {
        orderId,
        type: dto.type,
        serviceId: dto.serviceId,
        productId: dto.productId,
        packageId: dto.packageId,
        clientPackageItemId: dto.clientPackageItemId,
        professionalId,
        description,
        quantity: qty,
        unitPrice: unitPrice!,
        discountAmount,
        total,
        commissionPct: commissionPct ?? 0,
        commissionAmount,
      },
    });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  async updateItem(tenantId: string, actor: AuthUser, orderId: string, itemId: string, dto: UpdateItemDto) {
    await this.assertOpen(tenantId, orderId, actor);
    const item = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    const qty = dto.quantity ?? Number(item.quantity);
    const unitPrice = item.clientPackageItemId ? 0 : dto.unitPrice ?? Number(item.unitPrice);
    const discount = dto.discountAmount ?? Number(item.discountAmount);
    const commissionPct = dto.commissionPct === undefined ? Number(item.commissionPct ?? 0) : dto.commissionPct ?? 0;
    const total = money(unitPrice * qty - discount);
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { quantity: qty, unitPrice, discountAmount: discount, total, commissionPct, commissionAmount: pct(total, commissionPct), professionalId: dto.professionalId === undefined ? undefined : dto.professionalId },
    });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  async removeItem(tenantId: string, actor: AuthUser, orderId: string, itemId: string) {
    await this.assertOpen(tenantId, orderId, actor);
    await this.prisma.orderItem.deleteMany({ where: { id: itemId, orderId } });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  async setDiscount(tenantId: string, actor: AuthUser, orderId: string, dto: DiscountDto) {
    await this.assertOpen(tenantId, orderId, actor);
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        discountType: dto.discountType === undefined ? undefined : dto.discountType,
        discountValue: dto.discountValue,
        addToCashier: dto.addToCashier,
        notes: dto.notes,
        clientId: dto.clientId === undefined ? undefined : dto.clientId,
        professionalId: dto.professionalId === undefined ? undefined : dto.professionalId,
      },
    });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  // ------------------------------------------------------------------
  async addPayment(tenantId: string, actor: AuthUser, orderId: string, dto: PaymentDto) {
    const order = await this.assertOpen(tenantId, orderId, actor);
    const remaining = money(Number(order.total) - Number(order.paidTotal));
    if (remaining <= 0) throw new BadRequestException('Comanda já está paga');
    let amount = money(dto.amount);
    if (amount > remaining + 0.009) throw new BadRequestException(`Valor maior que o restante (R$ ${remaining.toFixed(2)})`);

    let feePct = dto.feePct ?? 0;
    const installments = dto.installments ?? 1;
    if (dto.feePct === undefined) {
      const cfg = await this.prisma.paymentMethodConfig.findUnique({ where: { tenantId_method: { tenantId, method: dto.method } } });
      if (cfg) {
        const byInst = (cfg.installmentFees as Record<string, number> | null)?.[String(installments)];
        feePct = byInst ?? Number(cfg.feePct);
        if (installments > cfg.maxInstallments) throw new BadRequestException(`Máximo de ${cfg.maxInstallments} parcela(s) para ${cfg.label ?? dto.method}`);
      }
    }
    if (dto.method === 'LOYALTY_POINTS') {
      if (!order.clientId) throw new BadRequestException('Comanda sem cliente');
      const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId } });
      if (!program?.isActive) throw new BadRequestException('Programa de fidelidade inativo');
      const points = dto.points ?? Math.ceil(amount * Number(program.pointsPerCurrency));
      const client = await this.prisma.client.findUniqueOrThrow({ where: { id: order.clientId } });
      if (client.loyaltyPoints < points) throw new BadRequestException(`Cliente tem apenas ${client.loyaltyPoints} pontos`);
      feePct = 0;
      await this.prisma.$transaction([
        this.prisma.client.update({ where: { id: client.id }, data: { loyaltyPoints: { decrement: points } } }),
        this.prisma.loyaltyTransaction.create({ data: { tenantId, clientId: client.id, type: 'REDEEM', points: -points, balanceAfter: client.loyaltyPoints - points, orderId, description: `Resgate na comanda #${order.number}` } }),
        this.prisma.order.update({ where: { id: orderId }, data: { loyaltyPointsRedeemed: { increment: points } } }),
      ]);
    }
    const feeAmount = pct(amount, feePct);
    await this.prisma.payment.create({
      data: { orderId, method: dto.method, amount, installments, feePct, feeAmount, netAmount: money(amount - feeAmount), reference: dto.reference },
    });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  async removePayment(tenantId: string, actor: AuthUser, orderId: string, paymentId: string) {
    const order = await this.assertOpen(tenantId, orderId, actor);
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, orderId } });
    if (!p) throw new NotFoundException('Pagamento não encontrado');
    if (p.method === 'LOYALTY_POINTS' && order.clientId) {
      const points = Math.abs(order.loyaltyPointsRedeemed);
      const client = await this.prisma.client.update({ where: { id: order.clientId }, data: { loyaltyPoints: { increment: points } } });
      await this.prisma.loyaltyTransaction.create({ data: { tenantId, clientId: client.id, type: 'ADJUST', points, balanceAfter: client.loyaltyPoints, orderId, description: 'Estorno de resgate' } });
      await this.prisma.order.update({ where: { id: orderId }, data: { loyaltyPointsRedeemed: 0 } });
    }
    await this.prisma.payment.delete({ where: { id: paymentId } });
    await this.recalc(orderId);
    return this.get(tenantId, orderId);
  }

  // ------------------------------------------------------------------
  /** Fecha a comanda: valida pagamento, lança no caixa, baixa estoque, gera comissões, pontua fidelidade, ativa pacotes */
  async close(tenantId: string, actor: AuthUser, orderId: string, dto: CloseOrderDto) {
    const tenant = await this.tenant(tenantId);
    for (const p of dto.payments ?? []) await this.addPayment(tenantId, actor, orderId, p);
    const order = await this.assertOpen(tenantId, orderId, actor);
    if (order.items.length === 0) throw new BadRequestException('Comanda sem itens');
    const remaining = money(Number(order.total) - Number(order.paidTotal));
    if (remaining > 0.009 && !dto.allowPartial) throw new BadRequestException(`Faltam R$ ${remaining.toFixed(2)} para fechar a comanda`);

    let cashierSessionId: string | null = null;
    if (order.addToCashier && order.kind === 'CLIENT') {
      const session = await this.prisma.cashierSession.findFirst({ where: { tenantId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
      if (!session) throw new BadRequestException('Abra o caixa antes de fechar comandas');
      cashierSessionId = session.id;
    }

    const refDate = new Date();
    await this.prisma.$transaction(async (tx) => {
      // caixa
      if (cashierSessionId) {
        for (const p of order.payments) {
          if (p.method === 'LOYALTY_POINTS' || p.method === 'PACKAGE') continue;
          await tx.cashMovement.create({
            data: { tenantId, cashierSessionId, type: 'SALE', method: p.method, amount: p.amount, description: `Comanda #${order.number}${order.client ? ' - ' + order.client.name : ''}`, paymentId: p.id, createdById: actor.sub },
          });
        }
      }
      // estoque + comissões + pacotes
      for (const item of order.items) {
        if (item.type === 'PRODUCT' && item.productId) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const newStock = Number(prod.stock) - Number(item.quantity);
            await tx.product.update({ where: { id: prod.id }, data: { stock: newStock } });
            await tx.stockMovement.create({
              data: { tenantId, productId: prod.id, type: order.kind === 'PROFESSIONAL_CONSUMPTION' ? 'USE' : 'SALE', quantity: -Number(item.quantity), unitCost: prod.costPrice, balanceAfter: newStock, orderId, reason: `Comanda #${order.number}`, createdById: actor.sub },
            });
          }
        }
        if (item.professionalId && Number(item.commissionAmount) > 0 && order.kind === 'CLIENT') {
          await tx.commissionEntry.create({
            data: { tenantId, professionalId: item.professionalId, orderId, orderItemId: item.id, baseAmount: item.total, pct: item.commissionPct ?? 0, amount: item.commissionAmount, referenceDate: refDate },
          });
        }
        if (item.clientPackageItemId) {
          await tx.clientPackageItem.update({ where: { id: item.clientPackageItemId }, data: { usedQty: { increment: Math.round(Number(item.quantity)) } } });
        }
        if (item.type === 'PACKAGE' && item.packageId && order.clientId) {
          const pk = await tx.package.findUnique({ where: { id: item.packageId }, include: { items: true } });
          if (pk) {
            await tx.clientPackage.create({
              data: {
                tenantId,
                clientId: order.clientId,
                packageId: pk.id,
                orderId,
                pricePaid: item.total,
                expiresAt: pk.validityDays ? new Date(Date.now() + pk.validityDays * 86400000) : null,
                items: { create: pk.items.map((pi) => ({ serviceId: pi.serviceId, productId: pi.productId, totalQty: pi.quantity })) },
              },
            });
          }
        }
      }
      // fidelidade (ganho de pontos)
      let earned = 0;
      if (order.clientId && order.kind === 'CLIENT') {
        const program = await tx.loyaltyProgram.findUnique({ where: { tenantId } });
        if (program?.isActive) {
          for (const item of order.items) {
            if (item.clientPackageItemId) continue;
            if (item.type === 'PRODUCT' && !program.includeProducts) continue;
            if (item.type === 'SERVICE' && item.serviceId) {
              const s = await tx.service.findUnique({ where: { id: item.serviceId }, select: { loyaltyPoints: true } });
              if (s?.loyaltyPoints !== null && s?.loyaltyPoints !== undefined) { earned += s.loyaltyPoints * Math.round(Number(item.quantity)); continue; }
            }
            if (item.type === 'PRODUCT' && item.productId) {
              const p = await tx.product.findUnique({ where: { id: item.productId }, select: { loyaltyPoints: true } });
              if (p?.loyaltyPoints !== null && p?.loyaltyPoints !== undefined) { earned += p.loyaltyPoints * Math.round(Number(item.quantity)); continue; }
            }
            if (item.type === 'SERVICE' || item.type === 'PRODUCT') earned += Math.floor(Number(item.total) * Number(program.pointsPerCurrency));
          }
          // não pontua a parte paga com pontos
          const paidWithPoints = order.payments.filter((p) => p.method === 'LOYALTY_POINTS').reduce((s, p) => s + Number(p.amount), 0);
          if (paidWithPoints > 0 && Number(order.total) > 0) earned = Math.floor(earned * (1 - paidWithPoints / Number(order.total)));
          if (earned > 0) {
            const c = await tx.client.update({ where: { id: order.clientId }, data: { loyaltyPoints: { increment: earned } } });
            await tx.loyaltyTransaction.create({ data: { tenantId, clientId: c.id, type: 'EARN', points: earned, balanceAfter: c.loyaltyPoints, orderId, description: `Comanda #${order.number}` } });
          }
        }
        await tx.client.update({
          where: { id: order.clientId },
          data: { visitsCount: { increment: 1 }, totalSpent: { increment: order.total }, lastVisitAt: new Date() },
        });
      }
      // fiado: gera conta a receber do restante
      if (remaining > 0.009 && order.clientId) {
        const cat = await tx.financeCategory.findFirst({ where: { tenantId, type: 'INCOME', name: 'Serviços' } });
        await tx.financeEntry.create({
          data: { tenantId, type: 'INCOME', status: 'PENDING', categoryId: cat?.id, description: `Comanda #${order.number} - ${order.client?.name ?? 'cliente'} (saldo em aberto)`, amount: remaining, dueDate: new Date(), orderId, createdById: actor.sub },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CLOSED', closedAt: new Date(), closedById: actor.sub, cashierSessionId, loyaltyPointsEarned: earned },
      });
      if (order.appointment) {
        await tx.appointment.update({ where: { id: order.appointment.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      }
    });
    this.logger.log(`Comanda #${order.number} fechada (${tenant.slug}) total=${order.total}`);
    return this.get(tenantId, orderId);
  }

  /** Reabre comanda fechada (estorna caixa, comissões, estoque, pontos) */
  async reopen(tenantId: string, actor: AuthUser, orderId: string) {
    if (actor.role === MemberRole.PROFESSIONAL) throw new ForbiddenException('Sem permissão para reabrir comandas');
    const order = await this.get(tenantId, orderId);
    if (order.status !== 'CLOSED') throw new BadRequestException('Comanda não está fechada');
    const paid = await this.prisma.commissionEntry.count({ where: { orderId, status: 'PAID' } });
    if (paid > 0) throw new BadRequestException('Não é possível reabrir: comissões desta comanda já foram pagas');
    if (order.cashierSessionId) {
      const s = await this.prisma.cashierSession.findUnique({ where: { id: order.cashierSessionId } });
      if (s?.status === 'CLOSED') throw new BadRequestException('Não é possível reabrir: o caixa desta comanda já foi fechado');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cashMovement.deleteMany({ where: { paymentId: { in: order.payments.map((p) => p.id) } } });
      await tx.commissionEntry.deleteMany({ where: { orderId } });
      await tx.financeEntry.deleteMany({ where: { orderId, status: 'PENDING' } });
      for (const item of order.items) {
        if (item.type === 'PRODUCT' && item.productId) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const newStock = Number(prod.stock) + Number(item.quantity);
            await tx.product.update({ where: { id: prod.id }, data: { stock: newStock } });
            await tx.stockMovement.create({ data: { tenantId, productId: prod.id, type: 'RETURN', quantity: Number(item.quantity), balanceAfter: newStock, orderId, reason: `Reabertura da comanda #${order.number}`, createdById: actor.sub } });
          }
        }
        if (item.clientPackageItemId) await tx.clientPackageItem.update({ where: { id: item.clientPackageItemId }, data: { usedQty: { decrement: Math.round(Number(item.quantity)) } } });
        if (item.type === 'PACKAGE') await tx.clientPackage.deleteMany({ where: { orderId } });
      }
      if (order.clientId) {
        const c = await tx.client.update({
          where: { id: order.clientId },
          data: { loyaltyPoints: { decrement: order.loyaltyPointsEarned }, visitsCount: { decrement: 1 }, totalSpent: { decrement: order.total } },
        });
        if (order.loyaltyPointsEarned > 0) await tx.loyaltyTransaction.create({ data: { tenantId, clientId: c.id, type: 'ADJUST', points: -order.loyaltyPointsEarned, balanceAfter: c.loyaltyPoints, orderId, description: `Reabertura da comanda #${order.number}` } });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'OPEN', closedAt: null, closedById: null, cashierSessionId: null, loyaltyPointsEarned: 0 } });
      if (order.appointment) await tx.appointment.update({ where: { id: order.appointment.id }, data: { status: 'IN_PROGRESS', completedAt: null } });
    });
    return this.get(tenantId, orderId);
  }

  async cancel(tenantId: string, actor: AuthUser, orderId: string) {
    const order = await this.assertOpen(tenantId, orderId, actor);
    if (order.payments.some((p) => p.method === 'LOYALTY_POINTS')) {
      for (const p of order.payments.filter((p) => p.method === 'LOYALTY_POINTS')) await this.removePayment(tenantId, actor, orderId, p.id);
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    if (order.appointment && order.appointment.status === 'IN_PROGRESS') {
      await this.prisma.appointment.update({ where: { id: order.appointment.id }, data: { status: 'CONFIRMED', orderId: null } });
    }
    return this.get(tenantId, orderId);
  }

  // ------------------------------------------------------------------
  async recalc(orderId: string) {
    const o = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true } });
    const subtotal = money(o.items.reduce((s, i) => s + Number(i.total), 0));
    let discountAmount = 0;
    if (o.discountType === 'PERCENT') discountAmount = pct(subtotal, Number(o.discountValue));
    if (o.discountType === 'AMOUNT') discountAmount = Math.min(subtotal, money(Number(o.discountValue)));
    const total = money(subtotal - discountAmount);
    const paidTotal = money(o.payments.reduce((s, p) => s + Number(p.amount), 0));
    const feesTotal = money(o.payments.reduce((s, p) => s + Number(p.feeAmount), 0));
    // comissão proporcional ao desconto geral
    if (discountAmount > 0 && subtotal > 0) {
      const factor = total / subtotal;
      for (const i of o.items) {
        const base = money(Number(i.total) * factor);
        await this.prisma.orderItem.update({ where: { id: i.id }, data: { commissionAmount: pct(base, Number(i.commissionPct ?? 0)) } });
      }
    } else {
      for (const i of o.items) {
        const amt = pct(Number(i.total), Number(i.commissionPct ?? 0));
        if (amt !== Number(i.commissionAmount)) await this.prisma.orderItem.update({ where: { id: i.id }, data: { commissionAmount: amt } });
      }
    }
    return this.prisma.order.update({ where: { id: orderId }, data: { subtotal, discountAmount, total, paidTotal, feesTotal } });
  }

  private async assertOpen(tenantId: string, orderId: string, actor: AuthUser) {
    const o = await this.get(tenantId, orderId);
    if (o.status !== 'OPEN') throw new BadRequestException('Comanda não está aberta');
    if (actor.role === MemberRole.PROFESSIONAL && o.professionalId && o.professionalId !== actor.professionalId && !o.items.some((i) => i.professionalId === actor.professionalId)) {
      throw new ForbiddenException('Esta comanda é de outro profissional');
    }
    return o;
  }

  tenant(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  }

  /** Resumo do dia para o painel de comandas */
  async daySummary(tenantId: string, date?: string) {
    const tenant = await this.tenant(tenantId);
    const d = date ?? toLocalDate(new Date(), tenant.timezone);
    const r = localDayRange(d, tenant.timezone);
    const [open, closed] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.order.aggregate({ where: { tenantId, status: 'CLOSED', closedAt: { gte: r.start, lte: r.end }, kind: 'CLIENT' }, _sum: { total: true, feesTotal: true }, _count: true }),
    ]);
    const byMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { order: { tenantId, status: 'CLOSED', closedAt: { gte: r.start, lte: r.end } } },
      _sum: { amount: true },
    });
    return { date: d, open, closedCount: closed._count, revenue: money(closed._sum.total), fees: money(closed._sum.feesTotal), byMethod: byMethod.map((m) => ({ method: m.method, amount: money(m._sum.amount) })) };
  }
}
