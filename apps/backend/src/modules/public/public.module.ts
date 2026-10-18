import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ClientsModule } from '../clients/clients.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ClientAreaController, PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [AppointmentsModule, ClientsModule, EngagementModule, LoyaltyModule],
  controllers: [PublicController, ClientAreaController],
  providers: [PublicService],
})
export class PublicModule {}
