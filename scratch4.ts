// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { BookingsService } from './src/bookings/bookings.service';
import { PricingService } from './src/pricing/pricing.service';
import { TrackingGateway } from './src/tracking/tracking.gateway';
import { NotificationService } from './src/notifications/notification.service';
import { PromoService } from './src/promo/promo.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const bookingsService = app.get(BookingsService);
  const prisma = app.get(PrismaClient);

  // Use the exact user that failed
  const userId = 'cmqtrmo5l000fclle8o3j4z6c';
  
  // Clear their bookings to simulate first booking again
  await prisma.booking.deleteMany({ where: { userId } });
  
  // Clear wallet balance of referrer
  await prisma.user.update({
    where: { id: 'cmqtrm8b0000dclle2nnsm7k0' },
    data: { walletBalance: 0 }
  });

  console.log('Simulating create booking...');
  try {
    const res = await bookingsService.create({
      type: 'FEW_ITEMS',
      pickupAddress: 'London',
      destinationAddress: 'London',
      pickupDate: new Date().toISOString(),
      pickupTimeSlot: 'SLOT_08_12',
      homeSize: 'STUDIO',
      moversCount: 1,
      extras: 'MATERIALS_ONLY',
      withStorage: false,
      distanceKm: 10,
      items: [{ name: 'Box', category: 'BOXES', widthCm: 50, heightCm: 50, depthCm: 50, quantity: 1 }]
    }, userId);
    console.log('Success:', res.id);
  } catch (err) {
    console.error('Error during create:', err);
  }

  const referrer = await prisma.user.findUnique({ where: { id: 'cmqtrm8b0000dclle2nnsm7k0' } });
  console.log('Referrer Wallet:', referrer?.walletBalance);
  
  await app.close();
}
test().catch(console.error);
