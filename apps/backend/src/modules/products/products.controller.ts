import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, Staff, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CreateProductDto, ProductCategoryDto, StockMovementDto, UpdateProductDto } from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Members() @Get()
  list(@TenantId() tenantId: string, @Query() q: any) {
    return this.products.list(tenantId, q);
  }

  @Staff() @Get('inventory')
  inventory(@TenantId() tenantId: string) {
    return this.products.inventory(tenantId);
  }

  @Staff() @Get('movements')
  movements(@TenantId() tenantId: string, @Query() q: any) {
    return this.products.movements(tenantId, q);
  }

  @Members() @Get('categories')
  categories(@TenantId() tenantId: string) {
    return this.products.listCategories(tenantId);
  }

  @Managers() @Post('categories')
  createCategory(@TenantId() tenantId: string, @Body() dto: ProductCategoryDto) {
    return this.products.createCategory(tenantId, dto);
  }

  @Managers() @Patch('categories/:id')
  updateCategory(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: ProductCategoryDto) {
    return this.products.updateCategory(tenantId, id, dto);
  }

  @Managers() @Delete('categories/:id')
  removeCategory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.products.removeCategory(tenantId, id);
  }

  @Members() @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.products.get(tenantId, id);
  }

  @Managers() @Post()
  create(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateProductDto) {
    return this.products.create(tenantId, actor, dto);
  }

  @Managers() @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(tenantId, id, dto);
  }

  @Managers() @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.products.remove(tenantId, id);
  }

  @Staff() @Post(':id/movements')
  move(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: StockMovementDto) {
    return this.products.move(tenantId, actor, id, dto);
  }
}
