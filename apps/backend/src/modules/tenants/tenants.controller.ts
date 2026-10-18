import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CreateMemberDto, PaymentMethodsDto, UpdateMemberDto, UpdateTenantDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Members()
  @Get()
  get(@TenantId() tenantId: string) {
    return this.tenants.get(tenantId);
  }

  @Managers()
  @Patch()
  update(@TenantId() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(tenantId, dto);
  }

  @Managers()
  @Get('members')
  members(@TenantId() tenantId: string) {
    return this.tenants.listMembers(tenantId);
  }

  @Managers()
  @Post('members')
  createMember(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateMemberDto) {
    return this.tenants.createMember(tenantId, actor, dto);
  }

  @Managers()
  @Patch('members/:id')
  updateMember(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.tenants.updateMember(tenantId, actor, id, dto);
  }

  @Managers()
  @Delete('members/:id')
  removeMember(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.tenants.removeMember(tenantId, actor, id);
  }

  @Managers()
  @Post('kiosk-token')
  kioskToken(@TenantId() tenantId: string) {
    return this.tenants.regenerateKioskToken(tenantId);
  }

  @Members()
  @Get('payment-methods')
  paymentMethods(@TenantId() tenantId: string) {
    return this.tenants.listPaymentMethods(tenantId);
  }

  @Managers()
  @Put('payment-methods')
  savePaymentMethods(@TenantId() tenantId: string, @Body() dto: PaymentMethodsDto) {
    return this.tenants.savePaymentMethods(tenantId, dto);
  }
}
