import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, status: true, pickupDate: true, pickupTimeSlot: true, createdAt: true }
  });
  console.log(JSON.stringify(bookings, null, 2));
}

main().finally(() => prisma.$disconnect());
