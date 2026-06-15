import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, PricingModule, AuditModule, NotificationModule],
  controllers: [ApprovalController],
})
export class ApprovalModule {}
