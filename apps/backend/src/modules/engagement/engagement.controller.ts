import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Managers, Members, Staff, TenantId } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { CampaignDto, ReturnRuleDto, WaitlistDto } from './engagement.dto';
import { EngagementService } from './engagement.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@Managers()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly eng: EngagementService) {}

  @Get() list(@TenantId() tenantId: string) { return this.eng.listCampaigns(tenantId); }
  @Post('audience/preview') preview(@TenantId() tenantId: string, @Body() body: { audience: Record<string, any> }) { return this.eng.previewAudience(tenantId, body?.audience ?? { all: true }); }
  @Get(':id') get(@TenantId() tenantId: string, @Param('id') id: string) { return this.eng.getCampaign(tenantId, id); }
  @Post() create(@TenantId() tenantId: string, @CurrentUser() actor: AuthUser, @Body() dto: CampaignDto) { return this.eng.createCampaign(tenantId, actor, dto); }
  @Patch(':id') update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CampaignDto) { return this.eng.updateCampaign(tenantId, id, dto); }
  @Post(':id/send') send(@TenantId() tenantId: string, @Param('id') id: string) { return this.eng.sendCampaign(tenantId, id); }
  @Post(':id/cancel') cancel(@TenantId() tenantId: string, @Param('id') id: string) { return this.eng.cancelCampaign(tenantId, id); }
  @Delete(':id') remove(@TenantId() tenantId: string, @Param('id') id: string) { return this.eng.deleteCampaign(tenantId, id); }
}

@ApiTags('waitlist')
@ApiBearerAuth()
@Members()
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly eng: EngagementService) {}

  @Get() list(@TenantId() tenantId: string, @Query() q: any) { return this.eng.listWaitlist(tenantId, q); }
  @Post() add(@TenantId() tenantId: string, @Body() dto: WaitlistDto) { return this.eng.addToWaitlist(tenantId, dto, 'ADMIN'); }
  @Patch(':id/status') status(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: { status: 'WAITING' | 'NOTIFIED' | 'BOOKED' | 'CANCELLED' }) { return this.eng.updateWaitlistStatus(tenantId, id, body.status); }
  @Post(':id/notify') notify(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: { text?: string }) { return this.eng.notifyWaitlistEntry(tenantId, id, body?.text); }
}

@ApiTags('return-rules')
@ApiBearerAuth()
@Managers()
@Controller('return-rules')
export class ReturnRulesController {
  constructor(private readonly eng: EngagementService) {}

  @Get() list(@TenantId() tenantId: string) { return this.eng.listReturnRules(tenantId); }
  @Post() create(@TenantId() tenantId: string, @Body() dto: ReturnRuleDto) { return this.eng.createReturnRule(tenantId, dto); }
  @Patch(':id') update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: ReturnRuleDto) { return this.eng.updateReturnRule(tenantId, id, dto); }
  @Delete(':id') remove(@TenantId() tenantId: string, @Param('id') id: string) { return this.eng.removeReturnRule(tenantId, id); }
}

@ApiTags('surveys')
@ApiBearerAuth()
@Controller('surveys')
export class SurveysController {
  constructor(private readonly eng: EngagementService) {}

  @Members() @Get() list(@TenantId() tenantId: string, @Query() q: any) { return this.eng.listSurveys(tenantId, q); }
}

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly eng: EngagementService) {}

  @Staff() @Get() list(@TenantId() tenantId: string, @Query() q: any) { return this.eng.messageLogs(tenantId, q); }
}
