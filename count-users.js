const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const count = await prisma.user.count();
  console.log('Total users:', count);
}
run();
