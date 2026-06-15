import { Controller, Get, Patch, Param, UseGuards, Request, Body, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { BookingStatus, NotificationType } from '@prisma/client';

@Controller('approval')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private auditService: AuditService,
    private notificationService: NotificationService
  ) {}

  @Get('pending')
  async getPendingApprovals(@Request() req) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        userId: req.user.id,
        status: { in: [BookingStatus.SCHEDULED, BookingStatus.LOADED, BookingStatus.IN_TRANSIT] }
      },
      include: {
        items: {
          where: { addedByDriver: true, customerApproved: false }
        }
      }
    });

    return bookings.filter(b => b.items.length > 0);
  }

  @Patch('bookings/:bookingId/items/:itemId/approve')
  async approveItem(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user.id },
      include: { items: true, driver: { include: { user: true } } }
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const item = await this.prisma.bookingItem.findFirst({
      where: { id: itemId, bookingId }
    });

    if (!item) throw new NotFoundException('Item not found');

    const updatedItem = await this.prisma.bookingItem.update({
      where: { id: itemId },
      data: { customerApproved: true }
    });

    // Log the approval
    await this.auditService.logChange(
      bookingId,
      req.user.id,
      'ITEM_APPROVED',
      { itemId, status: 'pending' },
      { itemId, status: 'approved' }
    );

    // Notify the driver
    if (booking.driver) {
      await this.notificationService.createNotification(
        booking.driver.userId,
        NotificationType.STATUS_CHANGE,
        'Item Approved',
        `Customer approved the addition of ${item.name}`,
        { bookingId, itemId }
      );
    }

    return updatedItem;
  }

  @Patch('bookings/:bookingId/items/:itemId/reject')
  async rejectItem(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user.id },
      include: { driver: { include: { user: true } } }
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const item = await this.prisma.bookingItem.findFirst({
      where: { id: itemId, bookingId }
    });

    if (!item) throw new NotFoundException('Item not found');

    // Remove the item completely
    await this.prisma.bookingItem.delete({
      where: { id: itemId }
    });

    // Log the rejection
    await this.auditService.logChange(
      bookingId,
      req.user.id,
      'ITEM_REJECTED',
      { itemId, item },
      null
    );

    // Notify the driver
    if (booking.driver) {
      await this.notificationService.createNotification(
        booking.driver.userId,
        NotificationType.STATUS_CHANGE,
        'Item Rejected',
        `Customer rejected the addition of ${item.name}`,
        { bookingId, itemId }
      );
    }

    return { success: true };
  }
}
