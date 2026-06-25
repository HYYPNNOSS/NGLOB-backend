import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testApi() {
  const email1 = `ref_${Date.now()}@example.com`;
  const email2 = `user_${Date.now()}@example.com`;

  const res1 = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Referrer', email: email1, password: 'password123' })
  });
  const refUser = await res1.json();

  const res2 = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name: 'Referred', 
      email: email2, 
      password: 'password123',
      referralCode: refUser.user.referralCode
    })
  });
  const newUser = await res2.json();
  const token = newUser.accessToken;

  const res3 = await fetch('http://localhost:3001/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      type: 'FEW_ITEMS',
      pickupAddress: 'London',
      destinationAddress: 'London',
      pickupDate: new Date().toISOString(),
      pickupTimeSlot: 'SLOT_08_12',
      homeSize: 'STUDIO',
      moversCount: 1,
      extras: 'MATERIALS_ONLY',
      withStorage: false,
      distanceKm: 10,
      items: [{ name: 'Box', category: 'BOXES', widthCm: 50, heightCm: 50, depthCm: 50, quantity: 1 }]
    })
  });
  const booking = await res3.json();
  console.log('Booking Error or Success:', JSON.stringify(booking, null, 2));

  const referrer = await prisma.user.findUnique({ where: { id: refUser.user.id } });
  console.log('Referrer Wallet:', referrer?.walletBalance);
}

testApi().catch(console.error).finally(() => prisma.$disconnect());
