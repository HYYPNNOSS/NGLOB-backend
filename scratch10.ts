import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'waawawaw@gmail.com' }
  });
  console.log('User ID:', user?.id);
}

checkUser().finally(() => prisma.$disconnect());
