import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findFirst({
    where: { bookingRef: 'REMUQMQ' },
  });
  console.log(JSON.stringify(b, null, 2));
}

main().finally(() => prisma.$disconnect());
