import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationModule } from '../notifications/notification.module';
import { BookingsService } from './bookings.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingsController } from './bookings.controller';
 
@Module({
  imports: [TrackingModule, NotificationModule],
  providers: [BookingsService, PricingService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
