import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromoDto } from './dto/promo.dto';

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  // POST /promo/validate — validate code and return discount info
  async validate(dto: ValidatePromoDto, userId?: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
      include: { uses: true },
    });

    if (!promo || !promo.isActive) {
      throw new BadRequestException('Invalid promo code');
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new BadRequestException('This promo code has expired');
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException('This promo code has reached its usage limit');
    }

    // Check if user already used this code
    if (userId) {
      const alreadyUsed = promo.uses.some(u => u.userId === userId);
      if (alreadyUsed) {
        throw new BadRequestException('You have already used this promo code');
      }
    }

    const total = dto.bookingTotal || 0;
    let discountAmount: number;

    if (promo.type === 'PERCENT') {
      discountAmount = Math.round(total * (promo.value / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(promo.value, total);
    }

    return {
      valid: true,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discountAmount,
      displayText: promo.type === 'PERCENT'
        ? `${promo.value}% off`
        : `£${promo.value} off`,
    };
  }

  // Apply code to a booking (called internally after payment)
  async applyToBooking(code: string, bookingId: string, userId?: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo) return;

    await Promise.all([
      this.prisma.promoCode.update({
        where: { id: promo.id },
        data:  { usedCount: { increment: 1 } },
      }),
      this.prisma.promoCodeUse.create({
        data: { promoCodeId: promo.id, userId, bookingId },
      }),
    ]);
  }

  // Seed default promo codes (call from seed.ts)
  async seedPromoCodes() {
    const codes = [
      { code: 'REMOVE20', type: 'PERCENT' as const, value: 20, maxUses: null },
      { code: 'WELCOME10', type: 'PERCENT' as const, value: 10, maxUses: null },
      { code: 'FIRSTMOVE', type: 'FIXED' as const, value: 30, maxUses: null },
    ];

    for (const c of codes) {
      await this.prisma.promoCode.upsert({
        where: { code: c.code },
        update: {},
        create: { ...c, isActive: true },
      });
    }
  }
}
