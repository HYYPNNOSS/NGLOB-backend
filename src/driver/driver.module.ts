import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [DriverController],

  providers: [DriverService, TrackingGateway],
  exports: [DriverService, TrackingGateway],
})
export class DriverModule {}
