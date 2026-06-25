import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { id: 'cmqtrmo5l000fclle8o3j4z6c' } // wawwwawwawa@gmail.com
  });
  console.log('Referred By ID:', user?.referredById);
  
  if (user?.referredById) {
    const referrer = await prisma.user.findUnique({ where: { id: user.referredById } });
    console.log('Referrer Email:', referrer?.email);
    console.log('Referrer Wallet:', referrer?.walletBalance);
  }
}

checkUser().finally(() => prisma.$disconnect());
