import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BillingModule } from '../billing/billing.module';
import { EngagementModule } from '../engagement/engagement.module';
import { AutomationService } from './automation.service';

@Module({
  imports: [AppointmentsModule, EngagementModule, BillingModule],
  providers: [AutomationService],
})
export class AutomationModule {}
