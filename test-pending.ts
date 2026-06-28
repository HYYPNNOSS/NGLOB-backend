import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.booking.count({ where: { status: 'PENDING' } });
  console.log("Pending count:", count);
}

main().finally(() => prisma.$disconnect());
