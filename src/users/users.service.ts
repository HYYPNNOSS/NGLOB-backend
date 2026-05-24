import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsOptional, IsString, IsEmail } from 'class-validator';
 
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
        phone: true, role: true, bonusPoints: true, createdAt: true,
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
        phone: true, role: true, bonusPoints: true,
      },
    });
  }
 
  async getBonuses(id: string) {
    const [user, history] = await Promise.all([
      this.prisma.user.findUnique({
        where:  { id },
        select: { bonusPoints: true },
      }),
      this.prisma.bonusHistory.findMany({
        where:   { userId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
 
    return {
      balance: user?.bonusPoints ?? 0,
      worthGbp: ((user?.bonusPoints ?? 0) * 0.01).toFixed(2),
      history,
    };
  }
}
