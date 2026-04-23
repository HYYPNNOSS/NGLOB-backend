import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function promote(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    console.log(`Success: ${email} is now an ADMIN`);
  } catch (e) {
    console.error(`Error: User with email ${email} not found.`);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx ts-node promote_admin.ts <email>');
} else {
  promote(email);
}
