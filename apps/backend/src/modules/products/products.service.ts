import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { money, paged, paging, parseDateOnly } from '../../common/utils';
import { CreateProductDto, ProductCategoryDto, StockMovementDto, UpdateProductDto } from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, q: { search?: string; categoryId?: string; lowStock?: string; forSale?: string; includeInactive?: string; page?: string; limit?: string }) {
    const p = paging(q, 50);
    const where: Prisma.ProductWhereInput = { tenantId, deletedAt: null };
    if (q.includeInactive !== 'true') where.isActive = true;
    if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }, { barcode: { contains: q.search } }, { brand: { contains: q.search, mode: 'insensitive' } }];
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.forSale === 'true') where.forSale = true;
    let items = await this.prisma.product.findMany({ where, include: { category: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } });
    if (q.lowStock === 'true') items = items.filter((i) => Number(i.stock) <= Number(i.minStock));
    const total = items.length;
    return paged(items.slice(p.skip, p.skip + p.take).map((i) => ({ ...i, lowStock: Number(i.stock) <= Number(i.minStock), stockValue: money(Number(i.stock) * Number(i.costPrice)) })), total, p);
  }

  async get(tenantId: string, id: string) {
    const prod = await this.prisma.product.findFirst({ where: { id, tenantId, deletedAt: null }, include: { category: true, movements: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!prod) throw new NotFoundException('Produto não encontrado');
    const sold = await this.prisma.orderItem.aggregate({ where: { productId: id, order: { status: 'CLOSED', kind: 'CLIENT' } }, _sum: { quantity: true, total: true } });
    const qty = Number(sold._sum.quantity ?? 0);
    const revenue = money(sold._sum.total);
    const cost = money(qty * Number(prod.costPrice));
    return { ...prod, stats: { soldQty: qty, revenue, cost, profit: money(revenue - cost) } };
  }

  async create(tenantId: string, actor: AuthUser, dto: CreateProductDto) {
    const { stock, ...rest } = dto;
    const prod = await this.prisma.product.create({
      data: { tenantId, ...rest, name: rest.name.trim(), expiresAt: rest.expiresAt ? parseDateOnly(rest.expiresAt.slice(0, 10)) : null, stock: stock ?? 0, costPrice: rest.costPrice ?? 0 },
    });
    if (stock && stock > 0) {
      await this.prisma.stockMovement.create({ data: { tenantId, productId: prod.id, type: 'IN', quantity: stock, unitCost: prod.costPrice, balanceAfter: stock, reason: 'Estoque inicial', createdById: actor.sub } });
    }
    return this.get(tenantId, prod.id);
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.get(tenantId, id);
    const { stock: _ignored, ...rest } = dto;
    await this.prisma.product.update({
      where: { id },
      data: { ...rest, name: rest.name?.trim(), expiresAt: rest.expiresAt === undefined ? undefined : rest.expiresAt ? parseDateOnly(rest.expiresAt.slice(0, 10)) : null },
    });
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { ok: true };
  }

  async move(tenantId: string, actor: AuthUser, id: string, dto: StockMovementDto) {
    const prod = await this.prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!prod) throw new NotFoundException('Produto não encontrado');
    if (dto.type === 'SALE' || dto.type === 'RETURN') throw new BadRequestException('Vendas e devoluções passam pelas comandas');
    const current = Number(prod.stock);
    let delta: number;
    if (dto.type === 'ADJUST') delta = money(dto.quantity - current);
    else if (dto.type === 'IN') delta = dto.quantity;
    else delta = -dto.quantity;
    const balance = money(current + delta);
    if (balance < 0) throw new BadRequestException(`Estoque insuficiente (saldo atual: ${current})`);
    const unitCost = dto.unitCost ?? Number(prod.costPrice);
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { stock: balance, ...(dto.updateCost && dto.unitCost !== undefined ? { costPrice: dto.unitCost } : {}) } }),
      this.prisma.stockMovement.create({ data: { tenantId, productId: id, type: dto.type, quantity: delta, unitCost, balanceAfter: balance, reason: dto.reason, createdById: actor.sub } }),
    ]);
    return this.get(tenantId, id);
  }

  async movements(tenantId: string, q: { productId?: string; from?: string; to?: string; type?: string; page?: string; limit?: string }) {
    const p = paging(q, 50);
    const where: Prisma.StockMovementWhereInput = { tenantId };
    if (q.productId) where.productId = q.productId;
    if (q.type) where.type = q.type as any;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to + 'T23:59:59.999Z') } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({ where, include: { product: { select: { id: true, name: true, unit: true } } }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async inventory(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId, deletedAt: null, isActive: true }, orderBy: { name: 'asc' } });
    const soon = new Date(Date.now() + 30 * 86400000);
    const rows = products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      stock: Number(p.stock),
      minStock: Number(p.minStock),
      costPrice: Number(p.costPrice),
      salePrice: Number(p.salePrice),
      stockValue: money(Number(p.stock) * Number(p.costPrice)),
      saleValue: money(Number(p.stock) * Number(p.salePrice)),
      lowStock: Number(p.stock) <= Number(p.minStock),
      expiresAt: p.expiresAt,
      expiringSoon: !!p.expiresAt && p.expiresAt <= soon,
      expired: !!p.expiresAt && p.expiresAt < new Date(),
    }));
    return {
      items: rows,
      totals: {
        products: rows.length,
        stockValue: money(rows.reduce((s, r) => s + r.stockValue, 0)),
        saleValue: money(rows.reduce((s, r) => s + r.saleValue, 0)),
        lowStock: rows.filter((r) => r.lowStock).length,
        expiringSoon: rows.filter((r) => r.expiringSoon).length,
      },
    };
  }

  // categorias
  listCategories(tenantId: string) {
    return this.prisma.productCategory.findMany({ where: { tenantId }, include: { _count: { select: { products: true } } }, orderBy: { name: 'asc' } });
  }
  createCategory(tenantId: string, dto: ProductCategoryDto) {
    return this.prisma.productCategory.create({ data: { tenantId, name: dto.name.trim() } });
  }
  async updateCategory(tenantId: string, id: string, dto: ProductCategoryDto) {
    const c = await this.prisma.productCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.productCategory.update({ where: { id }, data: { name: dto.name.trim() } });
  }
  async removeCategory(tenantId: string, id: string) {
    const c = await this.prisma.productCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Categoria não encontrada');
    await this.prisma.productCategory.delete({ where: { id } });
    return { ok: true };
  }
}
