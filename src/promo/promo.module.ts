import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';

@Module({
  imports: [PrismaModule],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService],
})
export class PromoModule {}
