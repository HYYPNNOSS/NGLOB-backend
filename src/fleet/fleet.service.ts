import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VAN_SIZES = [
  { id: 'small', name: 'Small Van', maxVolumeM3: 6 },
  { id: 'medium', name: 'Medium Transit', maxVolumeM3: 10 },
  { id: 'large', name: 'Luton Van', maxVolumeM3: 15 },
];

@Injectable()
export class FleetService {
  constructor(private prisma: PrismaService) {}

  recommendVehicle(totalVolumeM3: number) {
    // Add 10% buffer for poor packing
    const requiredVolume = totalVolumeM3 * 1.1;
    
    const van = VAN_SIZES.find(v => v.maxVolumeM3 >= requiredVolume);
    if (van) return van;
    
    // If larger than Luton, return Luton but maybe recommend multiple trips/vans in future
    return VAN_SIZES[2];
  }

  async scoreDriversForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true }
    });
    
    if (!booking) throw new Error('Booking not found');

    const totalVolume = booking.items.reduce((acc, item) => acc + (item.volumeM3 * item.quantity), 0);
    const recommendedVan = this.recommendVehicle(totalVolume);

    // Get active drivers with their availability and bookings for that day
    const bookingDay = booking.pickupDate.getDay();
    const bookingStartOfDay = new Date(booking.pickupDate);
    bookingStartOfDay.setHours(0,0,0,0);
    const bookingEndOfDay = new Date(bookingStartOfDay);
    bookingEndOfDay.setDate(bookingEndOfDay.getDate() + 1);

    const drivers = await this.prisma.driver.findMany({
      where: { 
        status: 'APPROVED',
        hasVan: true, // Only drivers with vans
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        availability: {
          where: { dayOfWeek: bookingDay, isActive: true }
        },
        bookings: {
          where: {
            pickupDate: { gte: bookingStartOfDay, lt: bookingEndOfDay },
            status: { notIn: ['CANCELLED', 'DELIVERED', 'UNREACHABLE'] }
          }
        }
      }
    });

    const scoredDrivers = drivers.map(driver => {
      let score = 100;
      let reasons = [];

      // 1. Availability check
      if (driver.availability.length === 0) {
        score -= 50;
        reasons.push('Not explicitly available this day');
      }

      // 2. Schedule conflict check (simplified)
      const hasConflict = driver.bookings.some(b => b.pickupTimeSlot === booking.pickupTimeSlot);
      if (hasConflict) {
        score -= 80;
        reasons.push('Schedule conflict (already booked for this slot)');
      }

      // 3. Proximity bonus (mocked since we don't have driver home address)
      // In a real app we'd use Google Distance Matrix API
      if (Math.random() > 0.5) {
        score += 20;
        reasons.push('Proximity bonus (nearby)');
      }
      
      // 4. Batching bonus for partial removals
      if (booking.type === 'FEW_ITEMS') {
         const hasOtherPartial = driver.bookings.some(b => b.type === 'FEW_ITEMS');
         if (hasOtherPartial && !hasConflict) {
           score += 40;
           reasons.push('Batching opportunity (has other partial loads today)');
         }
      }

      return {
        driver: {
          id: driver.id,
          name: driver.user.name,
          phone: driver.user.phone
        },
        score: Math.max(0, Math.min(100, score)), // Clamp 0-100
        reasons,
        recommendedVan
      };
    });

    // Sort highest score first
    return scoredDrivers.sort((a, b) => b.score - a.score);
  }
}
