// src/app/api/seller/invitation/validate/route.ts

import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { valid: false, error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        isActive: true,
        sellerProfile: {
          select: { id: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { valid: false, error: "Your account is unavailable." },
        { status: 403 }
      );
    }

    if (user.sellerProfile) {
      return NextResponse.json(
        { valid: false, error: "You already have a seller account." },
        { status: 409 }
      );
    }

    const params = new URL(req.url).searchParams;
    const token = params.get("token");
    const invitationId = params.get("invitationId");

    if ((!token && !invitationId) || (token && invitationId)) {
      return NextResponse.json(
        { valid: false, error: "Invalid invitation link." },
        { status: 400 }
      );
    }

    let invitation;

    if (token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return NextResponse.json(
          { valid: false, error: "Invalid invitation link." },
          { status: 400 }
        );
      }

      const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");

      invitation = await db.sellerInvitation.findUnique({
        where: { tokenHash },
      });
    } else {
      invitation = await db.sellerInvitation.findUnique({
        where: { id: invitationId! },
      });
    }

    if (
      !invitation ||
      invitation.email.toLowerCase().trim() !== user.email.toLowerCase().trim() ||
      invitation.redeemedAt ||
      invitation.revokedAt ||
      invitation.applicationId ||
      invitation.expiresAt <= new Date()
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This invitation is invalid, expired, revoked, already used, or belongs to another email address.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        message: "Your invitation is valid. You can proceed with your application.",
        expiresAt: invitation.expiresAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("Seller invitation validation error:", error);

    return NextResponse.json(
      { valid: false, error: "Unable to validate your invitation." },
      { status: 500 }
    );
  }
}
