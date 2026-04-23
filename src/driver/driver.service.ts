import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { BookingStatus } from '@prisma/client';
import { IsNumber, IsEnum } from 'class-validator';
 
export class UpdateLocationDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
}
 
export class UpdateBookingStatusDto {
  @IsEnum(['LOADED', 'DELIVERED', 'UNREACHABLE'])
  status: BookingStatus;
}
 
@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private tracking: TrackingGateway,
  ) {}
 
  // ── Update GPS position ───────────────────────────────────
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const driver = await this.prisma.driver.update({
      where:  { userId },
      data:   { currentLat: dto.lat, currentLng: dto.lng, isOnline: true },
      include: {
        bookings: {
          where: {
            status: { in: [BookingStatus.SCHEDULED, BookingStatus.LOADED] },
            pickupDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
          select: { id: true, status: true },
        },
      },
    });
 
    // Broadcast to all active bookings for this driver
    for (const booking of driver.bookings) {
      this.tracking.broadcastDriverLocation(booking.id, {
        lat:    dto.lat,
        lng:    dto.lng,
        status: booking.status,
      });
    }
 
    return { updated: true };
  }
 
  // ── Get today's assignments ───────────────────────────────
  async getAssignments(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
 
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
 
    return this.prisma.booking.findMany({
      where: {
        driverId:   driver.id,
        pickupDate: { gte: todayStart, lte: todayEnd },
        status: { in: [BookingStatus.SCHEDULED, BookingStatus.LOADED] },
      },
      include: { items: true, user: { select: { name: true, phone: true } } },
      orderBy: { pickupDate: 'asc' },
    });
  }
 
  // ── Update booking status ─────────────────────────────────
  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    userId: string,
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
 
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, driverId: driver.id },
    });
    if (!booking) throw new NotFoundException('Booking not found');
 
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { status },
    });
 
    // Notify customer via WebSocket
    this.tracking.broadcastDriverLocation(bookingId, {
      lat:    driver.currentLat!,
      lng:    driver.currentLng!,
      status: status.toString(),
    });
 
    return updated;
  }
}
