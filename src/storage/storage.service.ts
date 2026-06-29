import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageStatus, DeliveryStatus } from '@prisma/client';
import {
  CreateStorageDto, RequestDeliveryDto, UpdateStorageDto,
} from './dto/storage.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class StorageService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStorageDto, userId: string) {
    // Validate booking belongs to user if provided
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking || booking.userId !== userId) {
        throw new ForbiddenException();
      }
    }

    const storage = await this.prisma.storage.create({
      data: {
        storageRef:     `STR${nanoid(6).toUpperCase()}`,
        userId,
        bookingId:      dto.bookingId,
        weeklyPrice:    0, // calculated after items are added
        autoRenew:      dto.autoRenew,
        deliveryAddress: dto.deliveryAddress,
      },
    });

    return storage;
  }

  async findAllForUser(userId: string) {
    return this.prisma.storage.findMany({
      where: { userId },
      include: {
        items: true,
        deliveries: { orderBy: { scheduledAt: 'desc' }, take: 3 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const storage = await this.prisma.storage.findUnique({
      where: { id },
      include: {
        items: true,
        deliveries: { orderBy: { scheduledAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!storage) throw new NotFoundException('Storage not found');
    if (storage.userId !== userId) throw new ForbiddenException();

    return storage;
  }

  async getItems(id: string, userId: string) {
    const storage = await this.findOne(id, userId);
    return storage.items;
  }

  async requestDelivery(id: string, dto: RequestDeliveryDto, userId: string) {
    const storage = await this.findOne(id, userId);

    if (storage.status !== StorageStatus.ACTIVE) {
      throw new BadRequestException('Storage is not active');
    }

    // Count previous deliveries to determine cost
    const previousDeliveries = await this.prisma.storageDelivery.count({
      where: { storageId: id, status: { not: DeliveryStatus.CANCELLED } },
    });

    const cost = previousDeliveries === 0 ? 0 : 25; // first free, then £25

    const delivery = await this.prisma.storageDelivery.create({
      data: {
        storageId:       id,
        deliveryAddress: dto.deliveryAddress,
        deliveryDate:    new Date(dto.deliveryDate),
        deliveryTimeSlot: dto.deliveryTimeSlot,
        cost,
        items: dto.itemIds && dto.itemIds.length ? {
          create: dto.itemIds.map(itemId => ({ storageItemId: itemId }))
        } : undefined,
      },
    });

    return { delivery, cost };
  }

  async update(id: string, dto: UpdateStorageDto, userId: string) {
    await this.findOne(id, userId); // auth check

    return this.prisma.storage.update({
      where: { id },
      data: {
        ...(dto.deliveryAddress && { deliveryAddress: dto.deliveryAddress }),
        ...(dto.paymentMethodId && { paymentMethodId: dto.paymentMethodId }),
      },
    });
  }

  async cancel(id: string, userId: string) {
    const storage = await this.findOne(id, userId);

    if (storage.status === StorageStatus.CANCELLED) {
      throw new BadRequestException('Storage is already cancelled');
    }

    return this.prisma.storage.update({
      where: { id },
      data: { status: StorageStatus.CANCELLED, cancelledAt: new Date() },
    });
  }
}
