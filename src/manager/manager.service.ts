import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { BookingStatus, DriverStatus, Role } from '@prisma/client';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class ManagerBookingsQueryDto {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() driverId?: string;
}

export class ApplyAsManagerDto {
  @IsOptional() @IsString() experience?: string;
  @IsOptional() @IsString() phone?: string;
}

@Injectable()
export class ManagerService {
  constructor(private prisma: PrismaService, private tracking: TrackingGateway) {}

  // ── Helper: Auto-cancel expired bookings ────────────────────
  private async autoCancelExpiredBookings(bookings: any[]) {
    const now = new Date();
    const cancelledIds: string[] = [];

    for (const b of bookings) {
      if (b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.SCHEDULED) {
        if (b.pickupDate && b.pickupTimeSlot) {
          const parts = b.pickupTimeSlot.replace('SLOT_', '').split('_').map(Number);
          const endHour = parts[1] || 12;
          const deadline = new Date(b.pickupDate);
          deadline.setHours(endHour, 0, 0, 0);
          
          if (now.getTime() > deadline.getTime()) {
            cancelledIds.push(b.id);
            b.status = BookingStatus.CANCELLED; // Update in memory so the returned array reflects it
          }
        }
      }
    }

    if (cancelledIds.length > 0) {
      await this.prisma.booking.updateMany({
        where: { id: { in: cancelledIds } },
        data: { status: BookingStatus.CANCELLED },
      });
      // Broadcast to update any active dashboards
      this.tracking.broadcastToManagers('dashboard-updated');
      
      // Also notify drivers if any of these were assigned to them
      const assignedBookings = bookings.filter(b => cancelledIds.includes(b.id) && b.driverId);
      for (const b of assignedBookings) {
        if (b.driverId) this.tracking.broadcastToDriver(b.driverId, 'assignments-updated');
      }
    }
  }

  // ── Apply as a manager ──────────────────────────────────────
  async applyAsManager(userId: string, dto: ApplyAsManagerDto) {
    const existing = await this.prisma.managerApplication.findUnique({ where: { userId } });
    if (existing) {
      if (existing.status === 'REJECTED') {
        // Allow re-application after rejection
        return this.prisma.managerApplication.update({
          where: { userId },
          data: {
            experience: dto.experience,
            phone: dto.phone,
            status: 'PENDING',
            adminNotes: null,
          },
          include: { user: { select: { name: true, email: true } } },
        });
      }
      throw new ConflictException('You have already applied as a manager');
    }

    return this.prisma.managerApplication.create({
      data: {
        userId,
        experience: dto.experience,
        phone: dto.phone,
        status: 'PENDING',
      },
      include: { user: { select: { name: true, email: true } } },
    });
  }

  // ── Get application status ──────────────────────────────────
  async getApplicationStatus(userId: string) {
    const application = await this.prisma.managerApplication.findUnique({
      where: { userId },
      select: { id: true, status: true, adminNotes: true, createdAt: true, updatedAt: true },
    });
    return application; // null if hasn't applied
  }

  // ── Get all bookings (global for managers) ─────────────
  async getAllBookings(query: ManagerBookingsQueryDto) {
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

    await this.autoCancelExpiredBookings(bookings);

    return { bookings, total };
  }

  async confirmBooking(bookingId: string) {
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    this.tracking.broadcastToManagers('dashboard-updated');
    return updated;
  }

  // ── Cancel Booking (Manager UI) ──────────────────────────
  async cancelBooking(bookingId: string) {
    const targetBooking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!targetBooking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
    
    this.tracking.broadcastToManagers('dashboard-updated');
    if (updated.driverId) {
      this.tracking.broadcastToDriver(updated.driverId, 'assignments-updated');
    }
    
    return updated;
  }

  async assignDriver(bookingId: string, driverId: string, crewIds?: string[]) {
    const targetBooking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!targetBooking) throw new NotFoundException('Booking not found');

    const activeStatuses = [BookingStatus.SCHEDULED, BookingStatus.LOADED, BookingStatus.IN_TRANSIT, BookingStatus.UNLOADING];
    const allDriverIds = [driverId, ...(crewIds || [])];
    
    const targetDateStart = new Date(targetBooking.pickupDate);
    targetDateStart.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDateStart);
    targetDateEnd.setDate(targetDateEnd.getDate() + 1);

    const activeBookings = await this.prisma.booking.findMany({
      where: {
        status: { in: activeStatuses },
        pickupDate: { gte: targetDateStart, lt: targetDateEnd },
        OR: [
          { driverId: { in: allDriverIds } },
          { crew: { some: { driverId: { in: allDriverIds } } } }
        ]
      }
    });

    if (activeBookings.length > 0) {
      if (targetBooking.type === 'FULL_HOUSE') {
        throw new ConflictException('One or more selected drivers already have active removals on this date. A driver can only be assigned to one full house removal per day.');
      } else {
        const hasFullHouse = activeBookings.some(b => b.type === 'FULL_HOUSE');
        if (hasFullHouse) {
          throw new ConflictException('One or more selected drivers are already assigned to a full house removal today and cannot take partial removals.');
        }
      }
    }

    const data: any = { driverId, status: BookingStatus.SCHEDULED };
    if (crewIds && crewIds.length > 0) {
      data.crew = { 
        deleteMany: {},
        create: crewIds.map(id => ({ driverId: id }))
      };
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data,
      include: { driver: { include: { user: true } }, crew: { include: { driver: { include: { user: true } } } } },
    });
    this.tracking.broadcastToManagers('dashboard-updated');
    this.tracking.broadcastToDriver(driverId, 'assignments-updated');
    if (crewIds) {
      for (const cid of crewIds) {
        this.tracking.broadcastToDriver(cid, 'assignments-updated');
      }
    }
    return updated;
  }

  // ── Get drivers (global for managers) ──────────────────
  async getDrivers() {
    const bookingWhere: any = {
      status: { in: [BookingStatus.SCHEDULED, BookingStatus.LOADED] },
      pickupDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    };

    return this.prisma.driver.findMany({
      include: {
        user: { select: { name: true, phone: true, email: true } },
        bookings: {
          where: bookingWhere,
          select: { id: true, pickupDate: true, status: true, type: true },
        },
        availability: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });
  }

  // ── Dashboard stats (global for managers) ──────────────
  async getDashboardStats() {
    return Promise.all([
      this.prisma.booking.count({ where: { status: BookingStatus.SCHEDULED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.storage.count({ where: { status: 'ACTIVE' } }),
      this.prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      this.prisma.driver.count({ where: { status: DriverStatus.PENDING } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    ]).then(([scheduled, pending, activeStorage, revenue, pendingDrivers, confirmed]) => ({
      scheduledToday: scheduled,
      pendingPayment: pending,
      activeStorage,
      totalRevenue:   revenue._sum.totalPrice ?? 0,
      pendingDrivers,
      confirmedOrders: confirmed,
    }));
  }

  async updateDriverStatus(driverId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (status === DriverStatus.REJECTED) {
      await this.prisma.user.update({
        where: { id: driver.user.id },
        data: { role: 'CUSTOMER' },
      });
    } else if (status === DriverStatus.APPROVED) {
      await this.prisma.user.update({
        where: { id: driver.user.id },
        data: { role: 'DRIVER' },
      });
    }

  }

  // ── Get driver documents (for review) ──────────────────────
  async getDriverDocuments(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  // ── Get all drivers with their documents ───────────────────
  async getDriversWithDocuments() {
    return this.prisma.driver.findMany({
      include: {
        user: { select: { name: true, email: true, phone: true } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Review a single document ───────────────────────────────
  async reviewDocument(documentId: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) {
    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    });
  }

  // ── Active rides (live view for managers) ──────────────────
  async getActiveRides() {
    const activeStatuses = [
      BookingStatus.SCHEDULED,
      BookingStatus.LOADED,
      BookingStatus.IN_TRANSIT,
      BookingStatus.UNLOADING,
    ];

    const rides = await this.prisma.booking.findMany({
      where: {
        status: { in: activeStatuses },
        driverId: { not: null },
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true, email: true } },
          },
        },
        items: true,
      },
      orderBy: { pickupDate: 'asc' },
    });

    await this.autoCancelExpiredBookings(rides);
    return rides.filter((r: any) => r.status !== BookingStatus.CANCELLED);
  }

  // ── Ride detail (with history) ─────────────────────────────
  async getRideDetail(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true, email: true } },
          },
        },
        items: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        payments: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ── Completed rides (recent history) ───────────────────────
  async getCompletedRides(limit = 20) {
    return this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.DELIVERED, BookingStatus.UNREACHABLE] },
        driverId: { not: null },
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        driver: {
          include: {
            user: { select: { name: true, phone: true, email: true } },
          },
        },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
