import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkBooking() {
  const booking = await prisma.booking.findUnique({
    where: { id: 'cmqtrmrq9000hcllem9f76sw0' }
  });
  console.log(JSON.stringify(booking, null, 2));
}

checkBooking().finally(() => prisma.$disconnect());
