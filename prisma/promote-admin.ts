 // promote-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MY_EMAIL = "apikajacobtaase@gmail.com"; 
const NEW_PASSWORD = "ibuyjacob123"; 

async function main() {
  console.log(`🔍 Looking for user: ${MY_EMAIL}...`);

  let user = await prisma.user.findUnique({
    where: { email: MY_EMAIL },
  });

  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

  if (!user) {
    console.log("⚠️ User not found. Creating new Super Admin account...");
    user = await prisma.user.create({
      data: {
        email: MY_EMAIL,
        passwordHash: hashedPassword,
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log("✅ New Admin Account Created!");
  } else {
    console.log("✅ User found! Updating role to SUPER_ADMIN...");
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        role: 'SUPER_ADMIN',
        // Optional: Update password if you want to reset it
        passwordHash: hashedPassword, 
      },
    });
    console.log("🚀 SUCCESS! Role updated.");
  }

  console.log(`📧 Email: ${MY_EMAIL}`);
  console.log(`🔑 Password: ${NEW_PASSWORD}`);
  console.log("⚠️ Please log out and log back in on the live site to see the Admin Dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });