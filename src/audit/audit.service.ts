import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async logChange(
    bookingId: string,
    actorId: string,
    action: string,
    before: any,
    after: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          bookingId,
          actorId,
          action,
          before: before ? JSON.stringify(before) : null,
          after: after ? JSON.stringify(after) : null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create audit log for booking ${bookingId}`, err);
    }
  }

  async getLogsForBooking(bookingId: string) {
    return this.prisma.auditLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
