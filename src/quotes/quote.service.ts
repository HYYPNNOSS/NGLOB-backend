import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuoteService {
  constructor(private prisma: PrismaService) {}

  async saveDraft(
    userId: string,
    stateData: string,
    pickup?: string,
    destination?: string,
    totalPrice?: number,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // Quotes valid for 14 days

    return this.prisma.draftQuote.create({
      data: {
        userId,
        stateData,
        pickup,
        destination,
        totalPrice,
        expiresAt,
      },
    });
  }

  async getDrafts(userId: string) {
    return this.prisma.draftQuote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDraft(id: string, userId: string) {
    const draft = await this.prisma.draftQuote.findFirst({
      where: { id, userId },
    });
    
    if (!draft) {
      throw new NotFoundException('Draft quote not found');
    }
    
    return draft;
  }

  async deleteDraft(id: string, userId: string) {
    return this.prisma.draftQuote.deleteMany({
      where: { id, userId },
    });
  }
}
