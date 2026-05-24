import { PrismaClient } from '@prisma/client';
import { PromoService } from '../src/promo/promo.service';

const prisma = new PrismaClient();

async function main() {
  const promoService = new PromoService(prisma as any);
  await promoService.seedPromoCodes();
  console.log('✅ Promo codes seeded: REMOVE20, WELCOME10, FIRSTMOVE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
