import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { CampaignsController, MessagesController, ReturnRulesController, SurveysController, WaitlistController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [ClientsModule],
  controllers: [CampaignsController, WaitlistController, ReturnRulesController, SurveysController, MessagesController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
