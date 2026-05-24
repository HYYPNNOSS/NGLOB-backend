import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DriverStatus, Role, ManagerStatus } from '@prisma/client';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { CreateManagerDto, ApproveManagerDto, RejectManagerDto } from './dto/admin.dto';
 
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
      this.prisma.managerApplication.count({ where: { status: ManagerStatus.PENDING } }),
    ]).then(([scheduled, pending, activeStorage, revenue, pendingDrivers, pendingManagers]) => ({
      scheduledToday: scheduled,
      pendingPayment: pending,
      activeStorage,
      totalRevenue:   revenue._sum.totalPrice ?? 0,
      pendingDrivers,
      pendingManagers,
    }));
  }

  async updateDriverStatus(driverId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Sync user role with driver status
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

    return driver;
  }

  // ─── Manager Application Workflow ──────────────────────────

  async getManagerApplications(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.managerApplication.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveManagerApplication(applicationId: string, dto: ApproveManagerDto) {
    const application = await this.prisma.managerApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    // Update application status
    await this.prisma.managerApplication.update({
      where: { id: applicationId },
      data: { status: ManagerStatus.APPROVED },
    });

    // Promote user to MANAGER
    await this.prisma.user.update({
      where: { id: application.userId },
      data: {
        role: Role.MANAGER,
      },
    });

    return {
      id: application.id,
      userId: application.userId,
      name: application.user.name,
      email: application.user.email,
      status: 'APPROVED',
    };
  }

  async rejectManagerApplication(applicationId: string, dto: RejectManagerDto) {
    const application = await this.prisma.managerApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    return this.prisma.managerApplication.update({
      where: { id: applicationId },
      data: {
        status: ManagerStatus.REJECTED,
        adminNotes: dto.notes || null,
      },
    });
  }

  // ─── Manager Management (existing — enhanced) ─────────────

  async createManager(dto: CreateManagerDto) {
    const defaultPassword = dto.password || 'manager123';
    const hashed = await bcrypt.hash(defaultPassword, 12);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: { role: Role.MANAGER },
        select: { id: true, name: true, email: true, role: true },
      });
    }

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: Role.MANAGER,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async getManagers() {
    return this.prisma.user.findMany({
      where: { role: Role.MANAGER },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async removeManager(userId: string) {
    // Reset user role
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.CUSTOMER },
    });

    // Also update the application status if one exists
    const app = await this.prisma.managerApplication.findUnique({
      where: { userId },
    });
    if (app) {
      await this.prisma.managerApplication.update({
        where: { userId },
        data: { status: ManagerStatus.REJECTED, adminNotes: 'Demoted by admin' },
      });
    }

    return { id: userId, role: 'CUSTOMER' };
  }
}
