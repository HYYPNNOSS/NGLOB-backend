import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { BookingStatus, Role, DocumentStatus } from '@prisma/client';
import { IsNumber, IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';
 
export class UpdateLocationDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
}
 
export class UpdateBookingStatusDto {
  @IsEnum(['LOADED', 'DELIVERED', 'UNREACHABLE'])
  status: BookingStatus;
}

export class ApplyAsDriverDto {
  @IsOptional() @IsString() licensingAuthority?: string;
  @IsOptional() @IsBoolean() hasVan?: boolean;
}

export class UploadDocumentDto {
  @IsString() docType: string;
  @IsString() label: string;
  @IsString() fileName: string;
  @IsOptional() @IsString() fileUrl?: string;
}

export class AvailabilitySlotDto {
  @IsNumber() dayOfWeek: number; // 0-6
  @IsString() startTime: string; // "08:00"
  @IsString() endTime: string;   // "18:00"
  @IsBoolean() isActive: boolean;
}

export class SetAvailabilityDto {
  slots: AvailabilitySlotDto[];
}

export class ToggleDayDto {
  @IsBoolean() isActive: boolean;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}
 
// All required document types for a driver
const REQUIRED_DOCUMENTS = [
  { docType: 'dvla_driving_license', label: 'DVLA Driving License' },
  { docType: 'dvla_check_code', label: 'DVLA Check Code' },
  { docType: 'pco_driver_badge', label: 'PCO Driver Badge' },
  { docType: 'private_hire_driver_licence', label: 'Private Hire Driver Licence (TfL PCO paper licence)' },
  { docType: 'bank_statement', label: 'Bank statement' },
  { docType: 'private_hire_vehicle_licence', label: 'Private Hire Vehicle Licence' },
  { docType: 'mot_test_certificate', label: 'MOT Test Certificate' },
  { docType: 'v5c_logbook', label: "V5C logbook/New keeper's slip" },
  { docType: 'insurance_certificate', label: 'Insurance certificate' },
];

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private tracking: TrackingGateway,
  ) {}

  // ── Apply as a driver ──────────────────────────────────────
  async applyAsDriver(userId: string, dto?: ApplyAsDriverDto) {
    // Check if already applied
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('You have already applied as a driver');

    // Create driver record + update user role in a transaction
    const [driver] = await this.prisma.$transaction([
      this.prisma.driver.create({
        data: {
          userId,
          status: 'PENDING',
          licensingAuthority: dto?.licensingAuthority,
          hasVan: dto?.hasVan ?? false,
        },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: Role.DRIVER },
      }),
    ]);

    // Create all required document placeholders
    await this.prisma.driverDocument.createMany({
      data: REQUIRED_DOCUMENTS.map(doc => ({
        driverId: driver.id,
        docType: doc.docType,
        label: doc.label,
        status: 'NOT_PROVIDED' as DocumentStatus,
      })),
    });

    return driver;
  }

  // ── Get driver status ──────────────────────────────────────
  async getDriverStatus(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true, status: true, isOnline: true, updatedAt: true },
    });
    return driver; // null if not a driver
  }

  // ── Get driver documents ───────────────────────────────────
  async getDocuments(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Upload a document ──────────────────────────────────────
  async uploadDocument(userId: string, dto: UploadDocumentDto) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driverDocument.upsert({
      where: {
        driverId_docType: { driverId: driver.id, docType: dto.docType },
      },
      update: {
        fileName: dto.fileName,
        fileUrl: dto.fileUrl || null,
        status: 'UPLOADED' as DocumentStatus,
        uploadedAt: new Date(),
        reviewNote: null, // Clear any previous review notes
      },
      create: {
        driverId: driver.id,
        docType: dto.docType,
        label: dto.label,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl || null,
        status: 'UPLOADED' as DocumentStatus,
        uploadedAt: new Date(),
      },
    });
  }

  // ── Submit documents for review ────────────────────────────
  async submitDocumentsForReview(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    // Check that at least some documents are uploaded
    const docs = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
    });

    const uploadedCount = docs.filter(d => d.status !== 'NOT_PROVIDED').length;
    if (uploadedCount === 0) {
      throw new ConflictException('You must upload at least one document before submitting');
    }

    // Set driver status to PENDING (indicating review needed)
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { status: 'PENDING' },
    });

    return { submitted: true, uploadedCount, totalCount: docs.length };
  }

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

  // ── Availability ───────────────────────────────────────────
  async getAvailability(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const slots = await this.prisma.driverAvailability.findMany({
      where: { driverId: driver.id },
      orderBy: { dayOfWeek: 'asc' },
    });

    // If no slots exist, return defaults (Mon-Fri 08-18)
    if (slots.length === 0) {
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        startTime: '08:00',
        endTime: '18:00',
        isActive: i >= 1 && i <= 5, // Mon-Fri active
      }));
      return defaults;
    }

    return slots;
  }

  async setAvailability(userId: string, slots: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    // Upsert all 7 days
    const results = await Promise.all(
      slots.map(slot =>
        this.prisma.driverAvailability.upsert({
          where: { driverId_dayOfWeek: { driverId: driver.id, dayOfWeek: slot.dayOfWeek } },
          update: { startTime: slot.startTime, endTime: slot.endTime, isActive: slot.isActive },
          create: { driverId: driver.id, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, isActive: slot.isActive },
        })
      )
    );

    return results;
  }

  async toggleDayAvailability(userId: string, dayOfWeek: number, isActive: boolean, startTime?: string, endTime?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driverAvailability.upsert({
      where: { driverId_dayOfWeek: { driverId: driver.id, dayOfWeek } },
      update: { isActive, ...(startTime && { startTime }), ...(endTime && { endTime }) },
      create: { driverId: driver.id, dayOfWeek, startTime: startTime || '08:00', endTime: endTime || '18:00', isActive },
    });
  }
}
