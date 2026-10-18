import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CreateAdvanceDto, CreatePayoutDto } from './commissions.dto';
import { CommissionsService } from './commissions.service';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Members() @Get('summary')
  summary(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('from') from: string, @Query('to') to: string, @Query('professionalId') professionalId?: string) {
    return this.commissions.summary(tenantId, actor, from, to, professionalId);
  }

  @Members() @Get('entries')
  entries(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query() q: any) {
    return this.commissions.entries(tenantId, actor, q);
  }

  @Members() @Get('advances')
  advances(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('professionalId') professionalId?: string, @Query('status') status?: string) {
    return this.commissions.listAdvances(tenantId, actor, professionalId, status);
  }

  @Managers() @Post('advances')
  createAdvance(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateAdvanceDto) {
    return this.commissions.createAdvance(tenantId, actor, dto);
  }

  @Managers() @Delete('advances/:id')
  cancelAdvance(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.commissions.cancelAdvance(tenantId, id);
  }

  @Members() @Get('payouts')
  payouts(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('professionalId') professionalId?: string) {
    return this.commissions.listPayouts(tenantId, actor, professionalId);
  }

  @Managers() @Post('payouts/preview')
  preview(@TenantId() tenantId: string, @Body() dto: CreatePayoutDto) {
    return this.commissions.preview(tenantId, dto);
  }

  @Managers() @Post('payouts')
  createPayout(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreatePayoutDto) {
    return this.commissions.createPayout(tenantId, actor, dto);
  }

  @Members() @Get('payouts/:id')
  getPayout(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.commissions.getPayout(tenantId, id);
  }

  @Managers() @Post('payouts/:id/pay')
  pay(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: { method?: string; addToCashier?: boolean }) {
    return this.commissions.markPayoutPaid(tenantId, actor, id, body?.method, body?.addToCashier);
  }

  @Managers() @Delete('payouts/:id')
  deletePayout(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.commissions.deletePayout(tenantId, id);
  }
}
