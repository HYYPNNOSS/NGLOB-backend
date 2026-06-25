import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { id: 'cmqtrm8b0000dclle2nnsm7k0' }
  });
  console.log('User:', user?.id);
}

checkUser().finally(() => prisma.$disconnect());
