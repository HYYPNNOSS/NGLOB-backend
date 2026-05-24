import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { Stripe as StripeTypes } from 'stripe/cjs/stripe.core.js';
import { PaymentStatus, BookingStatus } from '@prisma/client';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() storageDeliveryId?: string;
  @IsOptional() @IsBoolean() isDeposit?: boolean;
}

@Injectable()
export class PaymentsService {
  private stripe: StripeTypes;

  constructor(
    private prisma: PrismaService,
    private bookingsService: BookingsService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20' as any,
    });
  }

  // ── Create PaymentIntent ──────────────────────────────────
  async createIntent(dto: CreatePaymentIntentDto, userId: string) {
    let amountPence: number;
    let metadata: Record<string, string> = { userId };

    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking || booking.userId !== userId) throw new NotFoundException();

      const amount = dto.isDeposit
        ? (booking.depositAmount ?? booking.totalPrice)
        : booking.totalPrice;

      amountPence = Math.round(amount * 100);
      metadata = {
        ...metadata,
        bookingId: dto.bookingId,
        isDeposit: dto.isDeposit ? 'true' : 'false',
      };
    } else if (dto.storageDeliveryId) {
      const delivery = await this.prisma.storageDelivery.findUnique({
        where: { id: dto.storageDeliveryId },
        include: { storage: true },
      });
      if (!delivery || delivery.storage.userId !== userId) {
        throw new NotFoundException();
      }
      if (delivery.cost === 0) {
        // Free delivery — no payment needed
        return { free: true, clientSecret: null };
      }
      amountPence = Math.round(delivery.cost * 100);
      metadata = { ...metadata, storageDeliveryId: dto.storageDeliveryId };
    } else {
      throw new BadRequestException('Must provide bookingId or storageDeliveryId');
    }

    const intent = await this.stripe.paymentIntents.create({
      amount:   amountPence,
      currency: 'gbp',
      metadata,
      automatic_payment_methods: { enabled: true },
    });

    // Record payment intent in DB
    await this.prisma.payment.create({
      data: {
        stripePaymentIntentId: intent.id,
        amount:                amountPence / 100,
        status:                PaymentStatus.PENDING,
        bookingId:             dto.bookingId,
        storageDeliveryId:     dto.storageDeliveryId,
        isDeposit:             dto.isDeposit ?? false,
      },
    });

    return { clientSecret: intent.client_secret };
  }

  // ── Stripe webhook ────────────────────────────────────────
  async handleWebhook(signature: string, rawBody: Buffer) {
    let event: StripeTypes.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.get('STRIPE_WEBHOOK_SECRET') || '',
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as StripeTypes.PaymentIntent;
      await this.handlePaymentSucceeded(intent);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as StripeTypes.PaymentIntent;
      await this.prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data:  { status: PaymentStatus.FAILED },
      });
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(intent: StripeTypes.PaymentIntent) {
    // Update payment record
    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data:  { status: PaymentStatus.SUCCEEDED },
    });

    const { bookingId, isDeposit, storageDeliveryId } = intent.metadata || {};

    if (bookingId) {
      // Activate booking + award bonus points
      await this.bookingsService.confirmPayment(bookingId, isDeposit === 'true');

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (booking) {
        await this.prisma.user.update({
          where: { id: booking.userId },
          data:  { bonusPoints: { increment: 50 } },
        });
        await this.prisma.bonusHistory.create({
          data: {
            userId: booking.userId,
            points: 50,
            action: `Booking ${booking.bookingRef} completed`,
          },
        });
      }
    }

    if (storageDeliveryId) {
      // Mark delivery as scheduled (already was, payment just confirms)
      await this.prisma.storageDelivery.update({
        where: { id: storageDeliveryId },
        data:  { status: 'SCHEDULED' },
      });
    }
  }
}
