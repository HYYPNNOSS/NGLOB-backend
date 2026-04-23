import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { PromoService } from '../promo/promo.service';
import { BookingStatus, ItemCategory } from '@prisma/client';
import { CreateBookingDto, RescheduleBookingDto } from './dto/create-booking.dto';
import { UpdateAddressesDto, UpdateItemsDto } from './dto/update-booking.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
    private tracking: TrackingGateway,
  ) {}

  // Add to create() method after pricing calculation:
  async applyPromoAndExactTime(
    promoCode: string | undefined,
    exactPickupTime: string | undefined,
    baseTotal: number,
    userId: string,
    promoService: PromoService,
  ): Promise<{ discountAmount: number; exactTimeFee: number; promoResult: any }> {
    let discountAmount = 0;
    let promoResult = null;

    if (promoCode) {
      try {
        promoResult = await promoService.validate({ code: promoCode, bookingTotal: baseTotal }, userId);
        discountAmount = promoResult.discountAmount;
      } catch {
        // Invalid promo — proceed without discount
      }
    }

    const exactTimeFee = exactPickupTime ? 60 : 0;

    return { discountAmount, exactTimeFee, promoResult };
  }

  // ── Create booking ────────────────────────────────────────
  async create(dto: CreateBookingDto, userId: string) {
    // Calculate pricing
    const pricing = this.pricingService.calculate({
      homeSize:       dto.homeSize,
      moversCount:    dto.moversCount,
      extras:         dto.extras,
      distanceKm:     dto.distanceKm,
      items:          dto.items.map(i => ({
        volumeM3: (i.widthCm * i.heightCm * i.depthCm) / 1_000_000,
        quantity: i.quantity,
      })),
      packingMaterials: dto.packingMaterials,
    });

    const depositAmount = dto.payDeposit ? 40 : undefined;
    const remainingAmount = dto.payDeposit
      ? Math.round((pricing.totalToPay - 40) * 100) / 100
      : undefined;

    const pickupDate = new Date(dto.pickupDate);
    const remainingDueAt = dto.payDeposit
      ? new Date(pickupDate)
      : undefined;

    const booking = await this.prisma.booking.create({
      data: {
        bookingRef:        `REM${nanoid(4).toUpperCase()}`,
        userId,
        type:              dto.type,
        status:            BookingStatus.PENDING,
        pickupAddress:     dto.pickupAddress,
        destinationAddress: dto.destinationAddress,
        pickupDate,
        pickupTimeSlot:    dto.pickupTimeSlot,
        estimatedDuration: pricing.totalDurationMins,
        homeSize:          dto.homeSize,
        moversCount:       dto.moversCount,
        extras:            dto.extras,
        withStorage:       dto.withStorage,
        notesForDriver:    dto.notesForDriver,

        // Pricing snapshot
        loadingTimeMins:       pricing.loadingTimeMins,
        travelTimeMins:        pricing.travelTimeMins,
        baseCost:              pricing.baseCost,
        additionalMoverCost:   pricing.additionalMoverCost,
        fuelCost:              pricing.fuelCost,
        fullPackingCost:       pricing.fullPackingCost,
        packingMaterialsCost:  pricing.packingMaterialsCost,
        totalPrice:            pricing.totalToPay,
        depositAmount,
        remainingAmount,
        remainingDueAt,

        items: {
          create: dto.items.map(item => ({
            name:        item.name,
            category:    item.category,
            widthCm:     item.widthCm,
            heightCm:    item.heightCm,
            depthCm:     item.depthCm,
            volumeM3:    (item.widthCm * item.heightCm * item.depthCm) / 1_000_000,
            quantity:    item.quantity,
            pricePerUnit: 10, // from catalog lookup in prod
          })),
        },

        packingMaterials: dto.packingMaterials ? {
          create: dto.packingMaterials
            .filter(m => m.quantity > 0)
            .map(m => ({
              type:        m.type,
              quantity:    m.quantity,
              pricePerUnit: this.pricingService['PRICING']?.PACKING_MATERIALS?.[m.type] ?? 0,
            })),
        } : undefined,
      },
      include: {
        items: true,
        packingMaterials: true,
      },
    });

    return { booking, pricing };
  }

  // ── Get all bookings for user ─────────────────────────────
  async findAllForUser(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      orderBy: { pickupDate: 'desc' },
      include: { items: true, driver: { include: { user: true } } },
    });

    const now = new Date();
    return {
      active:   bookings.filter(b =>
        ['PENDING', 'SCHEDULED', 'LOADED', 'UNREACHABLE'].includes(b.status),
      ),
      previous: bookings.filter(b =>
        ['DELIVERED', 'CANCELLED'].includes(b.status),
      ),
    };
  }

  // ── Get single booking ────────────────────────────────────
  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: true,
        packingMaterials: true,
        driver: { include: { user: { select: { name: true, phone: true } } } },
        payments: true,
        storage: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();

    return booking;
  }

  // ── Reschedule ────────────────────────────────────────────
  // Spec: free changes up to 3 days before move
  async reschedule(id: string, dto: RescheduleBookingDto, userId: string) {
    const booking = await this.findOne(id, userId);

    if (!['SCHEDULED', 'UNREACHABLE'].includes(booking.status)) {
      throw new BadRequestException('Cannot reschedule a booking in this state');
    }

    const newDate = new Date(dto.date);
    const daysUntil = (booking.pickupDate.getTime() - Date.now()) / 86_400_000;
    const rescheduleFee = daysUntil < 3 ? 30 : 0;

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        pickupDate:    newDate,
        pickupTimeSlot: dto.timeSlot as any,
        status:        BookingStatus.SCHEDULED,
      },
    });

    return { booking: updated, rescheduleFee };
  }

  // ── Cancel ────────────────────────────────────────────────
  // Spec: free cancellation up to 7 days before move.
  // After that, cancellation fee of 30% or £40 (whichever is higher).
  async cancel(id: string, userId: string) {
    const booking = await this.findOne(id, userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    const daysUntil = (booking.pickupDate.getTime() - Date.now()) / 86_400_000;
    let cancellationFee = 0;
    if (daysUntil < 7) {
      const thirtyPercent = Math.round(booking.totalPrice * 0.3 * 100) / 100;
      cancellationFee = Math.max(thirtyPercent, 40);
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });

    return { booking: updated, cancellationFee };
  }

  // ── Update addresses ──────────────────────────────────────
  // Spec: "You can make changes free of charge up to 3 days before your move."
  async updateAddresses(id: string, dto: UpdateAddressesDto, userId: string) {
    const booking = await this.findOne(id, userId);

    if (!['PENDING', 'SCHEDULED'].includes(booking.status)) {
      throw new BadRequestException('Cannot edit a booking in this state');
    }

    const daysUntil = (booking.pickupDate.getTime() - Date.now()) / 86_400_000;
    const editFee = daysUntil < 3 ? 30 : 0;

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        ...(dto.pickupAddress && { pickupAddress: dto.pickupAddress }),
        ...(dto.destinationAddress && { destinationAddress: dto.destinationAddress }),
        ...(dto.notesForDriver !== undefined && { notesForDriver: dto.notesForDriver }),
      },
    });

    return { booking: updated, editFee };
  }

  // ── Update items ──────────────────────────────────────────
  async updateItems(id: string, dto: UpdateItemsDto, userId: string) {
    const booking = await this.findOne(id, userId);

    if (!['PENDING', 'SCHEDULED'].includes(booking.status)) {
      throw new BadRequestException('Cannot edit items in this state');
    }

    const daysUntil = (booking.pickupDate.getTime() - Date.now()) / 86_400_000;
    const editFee = daysUntil < 3 ? 30 : 0;

    // Delete old items and create new ones
    await this.prisma.bookingItem.deleteMany({ where: { bookingId: id } });

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        items: {
          create: dto.items.map(item => ({
            name:        item.name,
            category:    item.category,
            widthCm:     item.widthCm,
            heightCm:    item.heightCm,
            depthCm:     item.depthCm,
            volumeM3:    (item.widthCm * item.heightCm * item.depthCm) / 1_000_000,
            quantity:    item.quantity,
            pricePerUnit: 10,
          })),
        },
      },
      include: { items: true },
    });

    return { booking: updated, editFee };
  }

  // ── Get tracking (last known driver position) ─────────────
  async getTracking(id: string, userId: string) {
    const booking = await this.findOne(id, userId);
    if (!booking.driver) {
      return { status: booking.status, driverAssigned: false };
    }

    return {
      status:    booking.status,
      driverAssigned: true,
      driverName: booking.driver.user.name,
      driverLat:  booking.driver.currentLat,
      driverLng:  booking.driver.currentLng,
    };
  }

  // ── Confirm payment (called by PaymentsService) ───────────
  async confirmPayment(bookingId: string, isDeposit: boolean) {
    const data: any = { status: BookingStatus.SCHEDULED };
    if (isDeposit) data.depositPaidAt = new Date();

    return this.prisma.booking.update({
      where: { id: bookingId },
      data,
    });
  }
}
