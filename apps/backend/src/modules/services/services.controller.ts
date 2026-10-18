import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Managers, Members, TenantId } from '../../common/decorators';
import { CategoryDto, CreateServiceDto, UpdateServiceDto } from './services.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Members() @Get()
  list(@TenantId() tenantId: string, @Query('includeInactive') inactive?: string) {
    return this.services.list(tenantId, inactive === 'true');
  }

  @Members() @Get('categories')
  categories(@TenantId() tenantId: string) {
    return this.services.listCategories(tenantId);
  }

  @Managers() @Post('categories')
  createCategory(@TenantId() tenantId: string, @Body() dto: CategoryDto) {
    return this.services.createCategory(tenantId, dto);
  }

  @Managers() @Patch('categories/:id')
  updateCategory(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CategoryDto) {
    return this.services.updateCategory(tenantId, id, dto);
  }

  @Managers() @Delete('categories/:id')
  removeCategory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.services.removeCategory(tenantId, id);
  }

  @Managers() @Put('reorder')
  reorder(@TenantId() tenantId: string, @Body() body: { ids: string[] }) {
    return this.services.reorder(tenantId, body.ids ?? []);
  }

  @Members() @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.services.get(tenantId, id);
  }

  @Managers() @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateServiceDto) {
    return this.services.create(tenantId, dto);
  }

  @Managers() @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(tenantId, id, dto);
  }

  @Managers() @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.services.remove(tenantId, id);
  }
}
