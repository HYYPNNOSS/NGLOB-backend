import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsOptional, IsString, IsEmail } from 'class-validator';
import { nanoid } from 'nanoid';
 
export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail()  email?: string;
  @IsOptional() @IsString() phone?: string;
}
 
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
 
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true,
        phone: true, role: true, walletBalance: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
 
  async update(id: string, dto: UpdateUserDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) throw new ConflictException('Email already in use');
    }
 
    return this.prisma.user.update({
      where: { id },
      data:  dto,
      select: {
        id: true, email: true, name: true,
        phone: true, role: true, walletBalance: true,
      },
    });
  }
 
  async linkReferral(userId: string, referralCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.referredById) throw new ConflictException('Account already linked to a referrer');

    const referrer = await this.prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.id === userId) throw new ConflictException('Cannot refer yourself');

    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    return { success: true, referredBy: referrer.name };
  }

  async getBonuses(id: string) {
    let user = await this.prisma.user.findUnique({
      where: { id },
      select: { walletBalance: true, referralCode: true },
    });

    if (user && !user.referralCode) {
      const newCode = nanoid(8);
      await this.prisma.user.update({
        where: { id },
        data: { referralCode: newCode },
      });
      user.referralCode = newCode;
    }

    const history = await this.prisma.bonusHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    const successfulReferrals = await this.prisma.user.count({
      where: {
        referredById: id,
        bookings: { some: {} },
      },
    });

    let currentTier = 'Friend';
    let rewardPerReferral = 1;
    let nextTierRequired = 5;

    if (successfulReferrals >= 10) {
      currentTier = 'Ambassador';
      rewardPerReferral = 3;
      nextTierRequired = 0;
    } else if (successfulReferrals >= 5) {
      currentTier = 'Partner';
      rewardPerReferral = 2;
      nextTierRequired = 10;
    }

    return {
      balance: user?.walletBalance ?? 0,
      history,
      referralCode: user?.referralCode,
      successfulReferrals,
      currentTier,
      rewardPerReferral,
      nextTierRequired,
    };
  }
}
