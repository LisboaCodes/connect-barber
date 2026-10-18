import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Managers, Members, Staff, TenantId } from '../../common/decorators';
import { AdjustPointsDto, ClubDto, LoyaltyProgramDto, LoyaltyRewardDto, PackageDto } from './loyalty.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Members() @Get('program')
  program(@TenantId() tenantId: string) {
    return this.loyalty.getProgram(tenantId);
  }

  @Managers() @Put('program')
  updateProgram(@TenantId() tenantId: string, @Body() dto: LoyaltyProgramDto) {
    return this.loyalty.updateProgram(tenantId, dto);
  }

  @Managers() @Post('rewards')
  createReward(@TenantId() tenantId: string, @Body() dto: LoyaltyRewardDto) {
    return this.loyalty.createReward(tenantId, dto);
  }

  @Managers() @Patch('rewards/:id')
  updateReward(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: LoyaltyRewardDto) {
    return this.loyalty.updateReward(tenantId, id, dto);
  }

  @Managers() @Delete('rewards/:id')
  removeReward(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.loyalty.removeReward(tenantId, id);
  }

  @Members() @Get('transactions')
  transactions(@TenantId() tenantId: string, @Query() q: any) {
    return this.loyalty.transactions(tenantId, q);
  }

  @Members() @Get('ranking')
  ranking(@TenantId() tenantId: string) {
    return this.loyalty.ranking(tenantId);
  }

  @Staff() @Post('clients/:clientId/adjust')
  adjust(@TenantId() tenantId: string, @Param('clientId') clientId: string, @Body() dto: AdjustPointsDto) {
    return this.loyalty.adjust(tenantId, clientId, dto);
  }

  @Staff() @Post('clients/:clientId/redeem/:rewardId')
  redeem(@TenantId() tenantId: string, @Param('clientId') clientId: string, @Param('rewardId') rewardId: string) {
    return this.loyalty.redeem(tenantId, clientId, rewardId, false);
  }

  @Staff() @Post('transactions/:id/confirm')
  confirm(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.loyalty.confirmRedeem(tenantId, id);
  }

  @Staff() @Post('transactions/:id/cancel')
  cancel(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.loyalty.cancelRedeem(tenantId, id);
  }
}

@ApiTags('packages')
@ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Members() @Get()
  list(@TenantId() tenantId: string, @Query('includeInactive') inactive?: string) {
    return this.loyalty.listPackages(tenantId, inactive === 'true');
  }

  @Members() @Get('clients')
  clientPackages(@TenantId() tenantId: string, @Query('clientId') clientId?: string, @Query('all') all?: string) {
    return this.loyalty.clientPackages(tenantId, clientId, all !== 'true');
  }

  @Managers() @Post()
  create(@TenantId() tenantId: string, @Body() dto: PackageDto) {
    return this.loyalty.createPackage(tenantId, dto);
  }

  @Managers() @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: PackageDto) {
    return this.loyalty.updatePackage(tenantId, id, dto);
  }

  @Managers() @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.loyalty.removePackage(tenantId, id);
  }
}

@ApiTags('clubs')
@ApiBearerAuth()
@Controller('clubs')
export class ClubsController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Members() @Get()
  list(@TenantId() tenantId: string) {
    return this.loyalty.listClubs(tenantId);
  }

  @Managers() @Post()
  create(@TenantId() tenantId: string, @Body() dto: ClubDto) {
    return this.loyalty.createClub(tenantId, dto);
  }

  @Managers() @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: ClubDto) {
    return this.loyalty.updateClub(tenantId, id, dto);
  }

  @Managers() @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.loyalty.removeClub(tenantId, id);
  }
}
