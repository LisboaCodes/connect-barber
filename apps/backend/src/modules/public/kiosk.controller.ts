import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { KioskService } from './kiosk.service';

/** Endpoints do totem de autoatendimento. Exigem o header x-kiosk-token da barbearia. */
@ApiTags('kiosk')
@Public()
@Controller('public/barbershops/:slug/kiosk')
export class KioskController {
  constructor(private readonly kiosk: KioskService) {}

  @Get('config')
  @ApiOperation({ summary: 'Configuração do totem (serviços, profissionais, formas de pagamento)' })
  config(@Param('slug') slug: string, @Headers('x-kiosk-token') token?: string) {
    return this.kiosk.config(slug, token);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('identify')
  identify(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Body() body: { phone: string }) {
    return this.kiosk.identify(slug, token, body?.phone);
  }

  @Post('register')
  register(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Body() body: { name: string; phone: string; email?: string }) {
    return this.kiosk.register(slug, token, body);
  }

  @Post('checkin/:appointmentId')
  checkin(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Param('appointmentId') appointmentId: string) {
    return this.kiosk.checkin(slug, token, appointmentId);
  }

  @Post('walk-in')
  walkIn(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Body() body: { clientId: string; serviceIds: string[]; professionalId?: string }) {
    return this.kiosk.walkIn(slug, token, body);
  }

  @Post('availability')
  availability(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Body() body: { clientId: string; date: string; serviceIds: string[]; professionalId?: string }) {
    return this.kiosk.bookingAvailability(slug, token, body);
  }

  @Post('appointments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  book(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Body() body: { clientId: string; serviceIds: string[]; professionalId: string; date: string; time: string }) {
    return this.kiosk.book(slug, token, body);
  }

  @Post('appointments/:appointmentId/pay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  payAppointment(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Param('appointmentId') appointmentId: string, @Body() body: { method: 'PIX' | 'COUNTER' }) {
    return this.kiosk.payAppointment(slug, token, appointmentId, body?.method ?? 'COUNTER');
  }

  @Post('orders/:orderId/pay')
  pay(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Param('orderId') orderId: string, @Body() body: { method: 'PIX' | 'POS' | 'COUNTER' }) {
    return this.kiosk.pay(slug, token, orderId, body?.method ?? 'COUNTER');
  }

  @Get('payments/:intentId')
  paymentStatus(@Param('slug') slug: string, @Headers('x-kiosk-token') token: string | undefined, @Param('intentId') intentId: string) {
    return this.kiosk.paymentStatus(slug, token, intentId);
  }
}
