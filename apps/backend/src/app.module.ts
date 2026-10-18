import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './core/infrastructure/database/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationModule } from './modules/automation/automation.module';
import { BillingModule } from './modules/billing/billing.module';
import { CashierModule } from './modules/cashier/cashier.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { PublicModule } from './modules/public/public.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ServicesModule } from './modules/services/services.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    MessagingModule,
    AuthModule,
    TenantsModule,
    ProfessionalsModule,
    ServicesModule,
    ClientsModule,
    AppointmentsModule,
    OrdersModule,
    PaymentsModule,
    CashierModule,
    ProductsModule,
    FinanceModule,
    CommissionsModule,
    LoyaltyModule,
    EngagementModule,
    ReportsModule,
    PublicModule,
    BillingModule,
    AutomationModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
