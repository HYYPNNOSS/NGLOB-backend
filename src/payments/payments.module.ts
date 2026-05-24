import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
 
@Module({
  imports: [BookingsModule, StorageModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
