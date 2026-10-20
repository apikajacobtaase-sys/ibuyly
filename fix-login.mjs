import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function fix() {
  console.log('🔧 Fixing login issues...\n');
  
  // 👇 CHANGE THIS TO YOUR EMAIL
  const email = "apikajacobtaase@gmail.com"; 
  const newPassword = "password123";
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log(`❌ User "${email}" not found.`);
    console.log('\n📋 Available users:');
    const allUsers = await prisma.user.findMany({ select: { email: true } });
    allUsers.forEach((u) => console.log(`   - ${u.email}`));
    return;
  }

  console.log(`✅ Found user: ${user.email}`);
  console.log(`   Current role: ${user.role}`);
  console.log(`   Current status: ${user.accountStatus || 'NULL (will fix)'}`);

  // Fix: Set accountStatus to ACTIVE if it's null
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashedPassword,
      accountStatus: user.accountStatus || "ACTIVE", // Fix null status
    },
  });

  // Also fix ALL other users with null accountStatus
  const fixedCount = await prisma.user.updateMany({
    where: { accountStatus: null },
    data: { accountStatus: "ACTIVE" },
  });

  console.log(`\n✅ Password reset to: ${newPassword}`);
  console.log(`✅ Account status set to: ACTIVE`);
  console.log(`✅ Fixed ${fixedCount.count} other users with null status`);
  console.log('\n🎉 You can now log in!');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${newPassword}`);
  console.log('\n⚠️  IMPORTANT: Clear your browser cookies or use Incognito mode!');
}

fix()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());