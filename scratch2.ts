import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
  const userId = 'cmqtrmo5l000fclle8o3j4z6c'; // wawwwawwawa@gmail.com
  
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { bookings: { select: { id: true } } }
  });
  
  console.log('User found:', user?.email);
  console.log('Bookings array:', user?.bookings);
  
  const isReferred = !!user?.referredById;
  const isFirstOrder = user?.bookings?.length === 0;
  
  console.log('isReferred:', isReferred);
  console.log('isFirstOrder:', isFirstOrder); // wait! If I run it now, it will be FALSE because they already have a booking!
}

debug().finally(() => prisma.$disconnect());
