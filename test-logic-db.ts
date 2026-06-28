import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findUnique({ where: { id: "cm0e8p2i3001v3l64j7k1w9i2" } });
  if (!b) return console.log("Not found");
  
  const now = new Date();
  
  console.log("b.pickupDate:", b.pickupDate);
  console.log("type of b.pickupDate:", typeof b.pickupDate);
  console.log("b.pickupDate is Date?", b.pickupDate instanceof Date);
  
  const parts = (b.pickupTimeSlot || "").replace('SLOT_', '').split('_').map(Number);
  const endHour = parts[1] || 12;
  const deadline = new Date(b.pickupDate);
  deadline.setHours(endHour, 0, 0, 0);
  
  console.log("now:", now);
  console.log("deadline:", deadline);
  console.log("now > deadline:", now.getTime() > deadline.getTime());
}

main().finally(() => prisma.$disconnect());
