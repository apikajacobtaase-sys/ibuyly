import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Diagnosing login issue...\n');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      accountStatus: true,
      passwordHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('📋 Recent Users in Database:');
  console.log('─'.repeat(80));
  users.forEach((u, i) => {
    console.log(`${i + 1}. Email: ${u.email}`);
    console.log(`   Name: ${u.firstName || ''} ${u.lastName || ''}`.trim());
    console.log(`   Role: ${u.role} | Status: ${u.accountStatus || '⚠️ NULL'}`);
    console.log(`   Password Hash: ${u.passwordHash.substring(0, 20)}...`);
    console.log(`   Created: ${u.createdAt}`);
    console.log('');
  });

  // Test password verification
  const testPassword = 'password123';
  console.log(`\n🧪 Testing password "${testPassword}" against each user:`);
  console.log('─'.repeat(80));
  
  for (const user of users) {
    const match = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`${user.email}: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
  }
}

diagnose()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());