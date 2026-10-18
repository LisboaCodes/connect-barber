import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import {
  CreateBlockDto,
  CreateOverrideDto,
  CreateProfessionalDto,
  SetWorkScheduleDto,
  UpdateProfessionalDto,
} from './professionals.dto';
import { ProfessionalsService } from './professionals.service';

@ApiTags('professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly pros: ProfessionalsService) {}

  @Members()
  @Get()
  list(@TenantId() tenantId: string, @Query('includeInactive') inactive?: string) {
    return this.pros.list(tenantId, inactive === 'true');
  }

  @Members()
  @Get('blocks')
  blocks(
    @TenantId() tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.pros.listBlocks(tenantId, new Date(from), new Date(to), professionalId);
  }

  @Members()
  @Post('blocks')
  createBlock(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateBlockDto) {
    return this.pros.createBlock(tenantId, actor, dto);
  }

  @Members()
  @Delete('blocks/:blockId')
  removeBlock(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Param('blockId') blockId: string) {
    return this.pros.removeBlock(tenantId, actor, blockId);
  }

  @Members()
  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.pros.get(tenantId, id);
  }

  @Managers()
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateProfessionalDto) {
    return this.pros.create(tenantId, dto);
  }

  @Managers()
  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateProfessionalDto) {
    return this.pros.update(tenantId, id, dto);
  }

  @Managers()
  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.pros.remove(tenantId, id);
  }

  @Members()
  @Put(':id/schedule')
  setSchedule(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() actor: AuthUser, @Body() dto: SetWorkScheduleDto) {
    return this.pros.setWorkSchedule(tenantId, id, actor, dto);
  }

  @Members()
  @Get(':id/overrides')
  overrides(@TenantId() tenantId: string, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pros.listOverrides(tenantId, id, from, to);
  }

  @Members()
  @Post(':id/overrides')
  createOverride(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() actor: AuthUser, @Body() dto: CreateOverrideDto) {
    return this.pros.createOverride(tenantId, id, actor, dto);
  }

  @Members()
  @Delete(':id/overrides/:overrideId')
  removeOverride(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() actor: AuthUser, @Param('overrideId') overrideId: string) {
    return this.pros.removeOverride(tenantId, id, actor, overrideId);
  }
}
