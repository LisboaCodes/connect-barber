import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Members, Staff, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { AddItemDto, CloseOrderDto, DiscountDto, OpenOrderDto, PaymentDto, UpdateItemDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Members()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query() q: any) {
    return this.orders.list(tenantId, actor, q);
  }

  @Get('summary')
  summary(@TenantId() tenantId: string, @Query('date') date?: string) {
    return this.orders.daySummary(tenantId, date);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.orders.get(tenantId, id);
  }

  @Post()
  open(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: OpenOrderDto) {
    return this.orders.open(tenantId, actor, dto);
  }

  @Post(':id/items')
  addItem(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: AddItemDto) {
    return this.orders.addItem(tenantId, actor, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateItemDto) {
    return this.orders.updateItem(tenantId, actor, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.orders.removeItem(tenantId, actor, id, itemId);
  }

  @Patch(':id')
  discount(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: DiscountDto) {
    return this.orders.setDiscount(tenantId, actor, id, dto);
  }

  @Post(':id/payments')
  addPayment(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.orders.addPayment(tenantId, actor, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  removePayment(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.orders.removePayment(tenantId, actor, id, paymentId);
  }

  @Post(':id/close')
  close(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: CloseOrderDto) {
    return this.orders.close(tenantId, actor, id, dto ?? {});
  }

  @Staff()
  @Post(':id/reopen')
  reopen(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.orders.reopen(tenantId, actor, id);
  }

  @Post(':id/cancel')
  cancel(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.orders.cancel(tenantId, actor, id);
  }
}
