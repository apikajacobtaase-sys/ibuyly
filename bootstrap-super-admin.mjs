// bootstrap-super-admin.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function bootstrap() {
  console.log('🔍 Checking for existing Super Admin...');
  
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (superAdmin) {
    console.log('✅ Super Admin already exists. Bootstrap aborted for security.');
    console.log(`   Email: ${superAdmin.email}`);
    return;
  }

  console.log('🚀 No Super Admin found. Starting bootstrap process...');
  
  // In a real scenario, you might prompt for these, but for this script, 
  // we use secure defaults that MUST be changed immediately.
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'superadmin@ibuy.com';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMeImmediately123!';
  
  console.log(`📧 Creating Super Admin: ${email}`);
  console.log('⚠️  WARNING: Change this password immediately after first login!');

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'SUPER_ADMIN_BOOTSTRAP',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email, note: 'Initial system bootstrap' },
    },
  });

  console.log('\n✅ SUCCESS! Super Admin created.');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('🔒 Please log in and change your password immediately.\n');
}

bootstrap()
  .catch((e) => {
    console.error('❌ Bootstrap failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });