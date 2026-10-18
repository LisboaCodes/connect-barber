import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ClientsModule } from '../clients/clients.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrdersModule } from '../orders/orders.module';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { ClientAreaController, PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [AppointmentsModule, ClientsModule, EngagementModule, LoyaltyModule, OrdersModule],
  controllers: [PublicController, ClientAreaController, KioskController],
  providers: [PublicService, KioskService],
})
export class PublicModule {}
