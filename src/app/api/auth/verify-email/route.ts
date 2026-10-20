// src/app/api/auth/verify-email/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { userId, token } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Find the latest unused token for this user
    const verificationToken = await db.emailVerificationToken.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    // Verify token hash
    const isValid = await bcrypt.compare(token, verificationToken.tokenHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification token" },
        { status: 400 }
      );
    }

    // Mark token as used and verify email
    await db.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    await db.auditLog.create({
      data: {
        userId,
        action: "EMAIL_VERIFIED",
        resourceType: "User",
        resourceId: userId,
      },
    });

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}