const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
  if (!user) { console.log('No driver found'); return; }
  
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production', { expiresIn: '30d' });
  
  console.log('Sending request with token for user:', user.email);
  const res = await fetch('http://localhost:3001/api/driver/assignments/cmqs97o3b000f18movlriljbo/status', {
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
