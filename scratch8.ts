import { PrismaClient, NotificationType } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany({ take: 1 });
  if (users.length > 0) {
    try {
      const notif = await prisma.notification.create({
        data: {
          userId: users[0].id,
          type: NotificationType.SYSTEM,
          title: 'Test',
          message: 'Test Message'
        }
      });
      console.log('Success:', notif);
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

test().finally(() => prisma.$disconnect());
