import { Module } from '@nestjs/common';
import { ClubsController, LoyaltyController, PackagesController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  controllers: [LoyaltyController, PackagesController, ClubsController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
