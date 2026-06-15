import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BookingsModule } from './bookings/bookings.module';
import { ItemsModule } from './items/items.module';
import { PricingModule } from './pricing/pricing.module';
import { StorageModule } from './storage/storage.module';
import { PaymentsModule } from './payments/payments.module';
import { DriverModule } from './driver/driver.module';
import { AdminModule } from './admin/admin.module';
import { TrackingModule } from './tracking/tracking.module';
import { PromoModule } from './promo/promo.module';
import { ManagerModule } from './manager/manager.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notifications/notification.module';
import { QuoteModule } from './quotes/quote.module';
import { FleetModule } from './fleet/fleet.module';
import { ApprovalModule } from './approval/approval.module';
 
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BookingsModule,
    ItemsModule,
    PricingModule,
    StorageModule,
    PaymentsModule,
    DriverModule,
    AdminModule,
    TrackingModule,
    PromoModule,
    ManagerModule,
    AuditModule,
    NotificationModule,
    QuoteModule,
    FleetModule,
    ApprovalModule,
  ],
})
export class AppModule {}
