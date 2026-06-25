const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
  if (!user) { console.log('No driver found'); return; }
  
  const driver = await prisma.driver.findUnique({ where: { userId: user.id } });
  if (!driver) { console.log('Driver profile not found'); return; }

  // Create a dummy booking for this driver
  const booking = await prisma.booking.create({
    data: {
      bookingRef: 'TEST_PATCH_' + Date.now(),
      userId: user.id, // self as customer for test
      driverId: driver.id,
      type: 'FEW_ITEMS',
      status: 'SCHEDULED',
      pickupAddress: 'Test',
      destinationAddress: 'Test',
      pickupDate: new Date(),
      pickupTimeSlot: 'EXACT',
      estimatedDuration: 60,
      loadingTimeMins: 30,
      travelTimeMins: 30,
      baseCost: 100,
      fuelCost: 10,
      totalPrice: 110,
    }
  });

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production', { expiresIn: '30d' });
  
  console.log('Sending request with token for user:', user.email);
  const res = await fetch(`http://localhost:3001/api/driver/assignments/${booking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'LOADED', truckPhoto: 'foo' })
  });
  
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
run();
