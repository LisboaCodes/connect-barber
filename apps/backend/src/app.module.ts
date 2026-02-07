import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core Infrastructure
import { PrismaModule } from './core/infrastructure/database/prisma/prisma.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ServicesModule } from './modules/services/services.module';
import { CashierModule } from './modules/cashier/cashier.module';
import { ProductsModule } from './modules/products/products.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Schedule (for cron jobs)
    ScheduleModule.forRoot(),

    // Event Emitter (for domain events)
    EventEmitterModule.forRoot(),

    // Database
    PrismaModule,

    // Feature Modules
    AuthModule,
    TenantsModule,
    UsersModule,
    AppointmentsModule,
    ServicesModule,
    CashierModule,
    ProductsModule,
    NotificationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
