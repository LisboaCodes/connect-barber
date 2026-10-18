import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Members() @Get('dashboard')
  dashboard(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.dashboard(tenantId, actor, from, to);
  }

  @Members() @Get('appointments')
  appointments(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('from') from: string, @Query('to') to: string, @Query('professionalId') professionalId?: string) {
    return this.reports.appointments(tenantId, actor, from, to, professionalId);
  }

  @Managers() @Get('occupancy')
  occupancy(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.occupancy(tenantId, from, to);
  }

  @Managers() @Get('retention')
  retention(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string, @Query('windowDays') windowDays?: string) {
    return this.reports.retention(tenantId, from, to, windowDays ? Number(windowDays) : 45);
  }

  @Managers() @Get('financial')
  financial(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.financial(tenantId, from, to);
  }

  @Managers() @Get('movements')
  movements(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.movements(tenantId, from, to);
  }

  @Managers() @Get('average-ticket')
  averageTicket(@TenantId() tenantId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.averageTicket(tenantId, from, to);
  }
}
