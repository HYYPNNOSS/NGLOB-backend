import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DriverStatus } from '@prisma/client';
import { IsOptional, IsString, IsEnum } from 'class-validator';
 
export class AdminBookingsQueryDto {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() driverId?: string;
}
 
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}
 
  async getAllBookings(query: AdminBookingsQueryDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.date) {
      const d = new Date(query.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.pickupDate = { gte: d, lt: next };
    }
    if (query.driverId) where.driverId = query.driverId;
 
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          user:   { select: { name: true, phone: true, email: true } },
          driver: { include: { user: { select: { name: true } } } },
          items:  true,
        },
        orderBy: { pickupDate: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
 
    return { bookings, total };
  }
 
  async assignDriver(bookingId: string, driverId: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data:  { driverId, status: BookingStatus.SCHEDULED },
      include: { driver: { include: { user: true } } },
    });
  }
 
  async getDrivers() {
    return this.prisma.driver.findMany({
      include: {
        user: { select: { name: true, phone: true, email: true } },
        bookings: {
          where: {
            status:     { in: [BookingStatus.SCHEDULED, BookingStatus.LOADED] },
            pickupDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
          select: { id: true, pickupDate: true, status: true },
        },
      },
    });
  }
 
  getDashboardStats() {
    return Promise.all([
      this.prisma.booking.count({ where: { status: BookingStatus.SCHEDULED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.storage.count({ where: { status: 'ACTIVE' } }),
      this.prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      this.prisma.driver.count({ where: { status: DriverStatus.PENDING } }),
    ]).then(([scheduled, pending, activeStorage, revenue, pendingDrivers]) => ({
      scheduledToday: scheduled,
      pendingPayment: pending,
      activeStorage,
      totalRevenue:   revenue._sum.totalPrice ?? 0,
      pendingDrivers,
    }));
  }

  async updateDriverStatus(driverId: string, status: DriverStatus) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
