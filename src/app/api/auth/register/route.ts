// src/app/api/auth/register/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, password, confirmPassword, phone, acceptTerms, role } = body;

    console.log("📝 Registration attempt for:", email, "with role:", role);

    // 1. Validate input
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({ error: "You must accept the Terms and Conditions" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // 2. Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // 3. 👇 FIX: Smart Role Mapping (Converts "SELLER" to "SELLER_OWNER" automatically)
    let assignedRole = "CUSTOMER";
    if (role === "SELLER" || role === "SELLER_OWNER") {
      assignedRole = "SELLER_OWNER";
    } else if (role === "SELLER_STAFF") {
      assignedRole = "SELLER_STAFF";
    }
    
    console.log("✅ Assigned Role:", assignedRole);

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create user and SellerProfile atomically
    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          role: assignedRole,
          accountStatus: "ACTIVE",
        },
      });

      // 👇 DEBUG: Check if we are creating the profile
      if (assignedRole === "SELLER_OWNER" || assignedRole === "SELLER_STAFF") {
        console.log("🛠️ Creating SellerProfile for user:", newUser.id);
        
        await tx.sellerProfile.create({
          data: {
            userId: newUser.id,
            businessName: `${firstName.trim()} ${lastName.trim()}'s Store`,
            description: "Auto-generated during registration",
            commissionRate: 10,
            isActive: true,
          },
        });
        console.log("✅ SellerProfile created successfully!");
      }

      return newUser;
    });

    // 6. Create email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(verificationToken, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // 7. Log the registration
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTERED",
        resourceType: "User",
        resourceId: user.id,
        metadata: { email: user.email, role: assignedRole },
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        userId: user.id,
        ...(isDev && { devVerificationToken: verificationToken }),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("🚨 Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}