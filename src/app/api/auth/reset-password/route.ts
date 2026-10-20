// src/app/api/auth/reset-password/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, otp, password } = await req.json();

    if (!email || !otp || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Find user with this email and valid OTP
    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        resetOtp: otp,
        resetOtpExpiry: { gt: new Date() }, // Must not be expired
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user and clear the OTP
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword, // Change to 'password' if your schema uses that
        resetOtp: null,
        resetOtpExpiry: null,
      },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("🚨 Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}