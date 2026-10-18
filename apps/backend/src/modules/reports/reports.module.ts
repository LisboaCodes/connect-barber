import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AppointmentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
