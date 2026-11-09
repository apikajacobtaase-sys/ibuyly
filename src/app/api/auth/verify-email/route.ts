// src/app/api/auth/verify-email/route.ts

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, token } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return NextResponse.json(
        { error: "Invalid verification parameters" },
        { status: 400 }
      );
    }

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

    const isValid = await bcrypt.compare(
      token,
      verificationToken.tokenHash
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification token" },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: {
          id: verificationToken.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (consumed.count !== 1) {
        throw new Error("TOKEN_ALREADY_USED");
      }

      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    await logAudit({
      userId,
      action: "EMAIL_VERIFIED",
      resourceType: "User",
      resourceId: userId,
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TOKEN_ALREADY_USED"
    ) {
      return NextResponse.json(
        { error: "This verification link has already been used or expired" },
        { status: 400 }
      );
    }

    console.error("Email verification error:", error);

    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}