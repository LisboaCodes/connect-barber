import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CreateFinanceEntryDto, FinanceCategoryDto, PayFinanceEntryDto, UpdateFinanceEntryDto } from './finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@Managers()
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('entries')
  list(@TenantId() tenantId: string, @Query() q: any) {
    return this.finance.list(tenantId, q);
  }

  @Get('cashflow')
  cashflow(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.finance.cashflow(tenantId, from, to);
  }

  @Get('categories')
  categories(@TenantId() tenantId: string) {
    return this.finance.listCategories(tenantId);
  }

  @Post('categories')
  createCategory(@TenantId() tenantId: string, @Body() dto: FinanceCategoryDto) {
    return this.finance.createCategory(tenantId, dto);
  }

  @Patch('categories/:id')
  updateCategory(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: FinanceCategoryDto) {
    return this.finance.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.removeCategory(tenantId, id);
  }

  @Get('entries/:id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.get(tenantId, id);
  }

  @Post('entries')
  create(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateFinanceEntryDto) {
    return this.finance.create(tenantId, actor, dto);
  }

  @Patch('entries/:id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateFinanceEntryDto) {
    return this.finance.update(tenantId, id, dto);
  }

  @Post('entries/:id/pay')
  pay(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: PayFinanceEntryDto) {
    return this.finance.pay(tenantId, actor, id, dto ?? {});
  }

  @Post('entries/:id/unpay')
  unpay(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.unpay(tenantId, id);
  }

  @Post('entries/:id/cancel')
  cancel(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.cancel(tenantId, id);
  }

  @Delete('entries/:id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.remove(tenantId, id);
  }
}
