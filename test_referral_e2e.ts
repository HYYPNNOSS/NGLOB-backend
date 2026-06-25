import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testReferralE2E() {
  console.log('=== E2E Referral Test ===\n');

  const ts = Date.now();
  const referrerEmail = `referrer_${ts}@test.com`;
  const friendEmail = `friend_${ts}@test.com`;

  // STEP 1: Register the referrer
  console.log('1. Registering referrer...');
  const r1 = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Referrer User', email: referrerEmail, password: 'test1234', phone: '07123456789' })
  });
  const referrerData = await r1.json();
  const referrerCode = referrerData.user.referralCode;
  const referrerId = referrerData.user.id;
  console.log(`   ✅ Referrer created: ${referrerEmail}, code: ${referrerCode}\n`);

  // STEP 2: Register friend WITH the referral code (this is what AuthModal now sends)
  console.log(`2. Registering friend with referralCode: ${referrerCode}...`);
  const r2 = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Friend User', email: friendEmail, password: 'test1234', phone: '07987654321', referralCode: referrerCode })
  });
  const friendData = await r2.json();
  const friendToken = friendData.accessToken;
  const friendId = friendData.user.id;
  console.log(`   ✅ Friend created: ${friendEmail}, referredById: ${friendData.user.referredById}\n`);

  // Verify referral link was established
  const friendUser = await prisma.user.findUnique({ where: { id: friendId } });
  console.log(`   DB check — friend.referredById: ${friendUser?.referredById}`);
  console.log(`   Match referrerId? ${friendUser?.referredById === referrerId ? '✅ YES' : '❌ NO'}\n`);

  // Check if referrer got a signup notification
  const signupNotifs = await prisma.notification.findMany({ where: { userId: referrerId } });
  console.log(`3. Referrer notifications after signup: ${signupNotifs.length}`);
  signupNotifs.forEach(n => console.log(`   📧 "${n.title}": ${n.message}`));
  console.log('');

  // STEP 3: Friend creates their first booking
  console.log('4. Friend placing their first booking...');
  const r3 = await fetch('http://localhost:3001/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${friendToken}` },
    body: JSON.stringify({
      type: 'FEW_ITEMS',
      pickupAddress: '10 Downing Street, London',
      destinationAddress: 'Buckingham Palace, London',
      pickupDate: new Date().toISOString(),
      pickupTimeSlot: 'SLOT_08_12',
      homeSize: 'STUDIO',
      moversCount: 1,
      extras: 'MATERIALS_ONLY',
      withStorage: false,
      distanceKm: 5,
      items: [{ name: 'Box', category: 'BOXES', widthCm: 50, heightCm: 50, depthCm: 50, quantity: 1 }]
    })
  });
  const bookingResult = await r3.json();
  console.log(`   ✅ Booking created, status: ${r3.status}\n`);

  // STEP 4: Check referrer's wallet
  const referrerAfter = await prisma.user.findUnique({ where: { id: referrerId } });
  console.log(`5. Referrer wallet after friend's first booking: £${referrerAfter?.walletBalance}`);
  console.log(`   Expected: £1 → ${referrerAfter?.walletBalance === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

  // STEP 5: Check bonus history
  const bonusHistory = await prisma.bonusHistory.findMany({ where: { userId: referrerId } });
  console.log(`6. Referrer bonus history entries: ${bonusHistory.length}`);
  bonusHistory.forEach(h => console.log(`   💰 £${h.amount}: ${h.action}`));
  console.log('');

  // STEP 6: Check all notifications
  const allNotifs = await prisma.notification.findMany({ where: { userId: referrerId }, orderBy: { createdAt: 'asc' } });
  console.log(`7. Referrer total notifications: ${allNotifs.length}`);
  allNotifs.forEach(n => console.log(`   📧 "${n.title}": ${n.message}`));

  console.log('\n=== Test Complete ===');
}

testReferralE2E().catch(console.error).finally(() => prisma.$disconnect());
