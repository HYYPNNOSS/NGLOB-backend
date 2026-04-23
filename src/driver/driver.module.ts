import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

@Module({
  controllers: [DriverController],
  providers: [DriverService, TrackingGateway],
  exports: [DriverService, TrackingGateway],
})
export class DriverModule {}
