import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkNotifs() {
  const notifs = await prisma.notification.findMany({
    where: { userId: 'cmqtrm8b0000dclle2nnsm7k0' }
  });
  console.log('Notifications for referrer:', JSON.stringify(notifs, null, 2));
}

checkNotifs().finally(() => prisma.$disconnect());
