import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { CategoryDto, CreateServiceDto, UpdateServiceDto } from './services.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  private readonly include = {
    category: { select: { id: true, name: true } },
    professionals: { select: { professionalId: true, price: true, durationMinutes: true } },
  };

  list(tenantId: string, includeInactive = false) {
    return this.prisma.service.findMany({
      where: { tenantId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      include: this.include,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const s = await this.prisma.service.findFirst({ where: { id, tenantId, deletedAt: null }, include: this.include });
    if (!s) throw new NotFoundException('Serviço não encontrado');
    return s;
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    const { professionalIds, ...rest } = dto;
    if (rest.categoryId) await this.assertCategory(tenantId, rest.categoryId);
    const count = await this.prisma.service.count({ where: { tenantId } });
    const s = await this.prisma.service.create({
      data: { tenantId, ...rest, name: rest.name.trim(), displayOrder: rest.displayOrder ?? count },
    });
    if (professionalIds?.length) await this.setProfessionals(tenantId, s.id, professionalIds);
    return this.get(tenantId, s.id);
  }

  async update(tenantId: string, id: string, dto: UpdateServiceDto) {
    await this.get(tenantId, id);
    const { professionalIds, ...rest } = dto;
    if (rest.categoryId) await this.assertCategory(tenantId, rest.categoryId);
    await this.prisma.service.update({ where: { id }, data: { ...rest, name: rest.name?.trim() } });
    if (professionalIds) await this.setProfessionals(tenantId, id, professionalIds);
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.service.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { ok: true };
  }

  async reorder(tenantId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.service.updateMany({ where: { id, tenantId }, data: { displayOrder: i } })),
    );
    return this.list(tenantId, true);
  }

  private async setProfessionals(tenantId: string, serviceId: string, professionalIds: string[]) {
    const valid = await this.prisma.professional.findMany({ where: { tenantId, id: { in: professionalIds } }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.serviceProfessional.deleteMany({ where: { serviceId } }),
      this.prisma.serviceProfessional.createMany({ data: valid.map((p) => ({ serviceId, professionalId: p.id })) }),
    ]);
  }

  // ---------- categorias ----------
  listCategories(tenantId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { services: true } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(tenantId: string, dto: CategoryDto) {
    const count = await this.prisma.serviceCategory.count({ where: { tenantId } });
    return this.prisma.serviceCategory.create({ data: { tenantId, name: dto.name.trim(), displayOrder: dto.displayOrder ?? count } });
  }

  async updateCategory(tenantId: string, id: string, dto: CategoryDto) {
    await this.assertCategory(tenantId, id);
    return this.prisma.serviceCategory.update({ where: { id }, data: { name: dto.name.trim(), displayOrder: dto.displayOrder } });
  }

  async removeCategory(tenantId: string, id: string) {
    await this.assertCategory(tenantId, id);
    await this.prisma.serviceCategory.delete({ where: { id } });
    return { ok: true };
  }

  private async assertCategory(tenantId: string, id: string) {
    const c = await this.prisma.serviceCategory.findFirst({ where: { id, tenantId } });
    if (!c) throw new BadRequestException('Categoria não encontrada');
    return c;
  }
}
