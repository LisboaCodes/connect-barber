import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { SurveyAnswerDto } from '../engagement/engagement.dto';
import { EngagementService } from '../engagement/engagement.service';
import { PLANS } from '../billing/plans';
import { PublicBookingDto, PublicWaitlistDto } from './public.dto';
import { PublicService } from './public.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly pub: PublicService, private readonly eng: EngagementService) {}

  @Public() @Get('plans')
  plans() {
    return PLANS.filter((p) => p.code !== 'TRIAL');
  }

  @Public() @Get('barbershops/:slug')
  @ApiOperation({ summary: 'Site público da barbearia' })
  site(@Param('slug') slug: string) {
    return this.pub.site(slug);
  }

  @Public() @Get('barbershops/:slug/availability')
  availability(@Param('slug') slug: string, @Query() q: any) {
    return this.pub.availability(slug, q);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('barbershops/:slug/book')
  @ApiOperation({ summary: 'Agendamento online (logado ou não)' })
  book(@Param('slug') slug: string, @CurrentUser() user: AuthUser | undefined, @Body() dto: PublicBookingDto) {
    return this.pub.book(slug, user, dto);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('barbershops/:slug/waitlist')
  waitlist(@Param('slug') slug: string, @CurrentUser() user: AuthUser | undefined, @Body() dto: PublicWaitlistDto) {
    return this.pub.joinWaitlist(slug, user, dto);
  }

  @Public() @Get('surveys/:token')
  survey(@Param('token') token: string) {
    return this.eng.getSurveyByToken(token);
  }

  @Public() @Post('surveys/:token')
  answerSurvey(@Param('token') token: string, @Body() dto: SurveyAnswerDto) {
    return this.eng.answerSurvey(token, dto);
  }

  @Public() @Get('campaigns/:campaignId/read/:clientId')
  async trackRead(@Param('campaignId') campaignId: string, @Param('clientId') clientId: string) {
    await this.eng.trackRead(campaignId, clientId);
    return { ok: true };
  }
}

@ApiTags('client-area')
@ApiBearerAuth()
@Controller('me')
export class ClientAreaController {
  constructor(private readonly pub: PublicService) {}

  @Get('appointments')
  appointments(@CurrentUser() user: AuthUser) {
    return this.pub.myAppointments(user);
  }

  @Post('appointments/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pub.cancelMyAppointment(user, id);
  }

  @Get('barbershops')
  profile(@CurrentUser() user: AuthUser) {
    return this.pub.myProfile(user);
  }

  @Get('barbershops/:clientId/loyalty')
  loyalty(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.pub.myLoyalty(user, clientId);
  }

  @Post('barbershops/:clientId/redeem/:rewardId')
  redeem(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Param('rewardId') rewardId: string) {
    return this.pub.requestRedeem(user, clientId, rewardId);
  }

  @Patch('phone')
  phone(@CurrentUser() user: AuthUser, @Body() body: { phone: string }) {
    return this.pub.updateMyPhone(user, body.phone);
  }
}
