import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const referrer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  if (!referrer) throw new Error('No referrer found');
  console.log('Referrer:', referrer.id, 'Code:', referrer.referralCode);

  const email = `test_referral_${Date.now()}@example.com`;
  const newUser = await prisma.user.create({
    data: {
      name: 'Test Referred',
      email,
      password: 'test',
      referralCode: `TEST${Date.now()}`,
      referredById: referrer.id
    }
  });
  console.log('New user created:', newUser.id, 'Referred By:', newUser.referredById);
  
  // Try calling the BookingsService logic manually to simulate what happens
  const user = await prisma.user.findUnique({ 
    where: { id: newUser.id },
    include: { bookings: { select: { id: true } } }
  });
  
  const isReferred = !!user?.referredById;
  const isFirstOrder = user?.bookings?.length === 0;
  console.log('isReferred:', isReferred, 'isFirstOrder:', isFirstOrder);
  
  if (isReferred && isFirstOrder && user?.referredById) {
    const referrerId = user.referredById;
    const successfulReferrals = await prisma.user.count({
      where: {
        referredById: referrerId,
        bookings: { some: {} },
      },
    });
    console.log('successfulReferrals:', successfulReferrals);
    
    let reward = 1;
    if (successfulReferrals >= 9) reward = 3;
    else if (successfulReferrals >= 4) reward = 2;
    console.log('Calculated reward:', reward);
    
    await prisma.user.update({
      where: { id: referrerId },
      data: { walletBalance: { increment: reward } },
    });
    console.log('Wallet updated');
  } else {
    console.log('Condition not met');
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
