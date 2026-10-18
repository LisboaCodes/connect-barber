import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Members, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { ChangeStatusDto, CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Members()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('agenda')
  @ApiOperation({ summary: 'Agenda do período (agendamentos, bloqueios e jornadas)' })
  agenda(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query('from') from: string, @Query('to') to: string, @Query('professionalId') professionalId?: string) {
    return this.appointments.agenda(tenantId, actor, from, to ?? from, professionalId);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Horários livres por profissional em uma data' })
  availability(@TenantId() tenantId: string, @Query() q: any) {
    return this.appointments.availability(tenantId, q);
  }

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Query() q: any) {
    return this.appointments.list(tenantId, actor, q);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.appointments.get(tenantId, id, actor);
  }

  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(tenantId, actor, dto, 'ADMIN');
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(tenantId, actor, id, dto);
  }

  @Patch(':id/status')
  status(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.appointments.changeStatus(tenantId, actor, id, dto, 'STAFF');
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.appointments.remove(tenantId, actor, id);
  }
}
