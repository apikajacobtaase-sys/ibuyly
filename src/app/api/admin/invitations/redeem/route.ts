// src/app/api/admin/invitations/redeem/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { invitationId, rawToken } = await req.json();

    if (!invitationId || !rawToken) {
      return NextResponse.json({ error: "Missing invitation ID or token" }, { status: 400 });
    }

    const invitation = await db.adminInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.revokedAt) {
      return NextResponse.json({ error: "This invitation has been revoked" }, { status: 403 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 403 });
    }

    if (invitation.redeemedAt) {
      return NextResponse.json({ error: "This invitation has already been used" }, { status: 403 });
    }

    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: "This invitation was sent to a different email address" }, { status: 403 });
    }

    // Verify token
    const isValid = await bcrypt.compare(rawToken, invitation.tokenHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 403 });
    }

    // Redeem: Update user role and mark invitation as used
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { 
          role: invitation.role as any,
          redeemedInvitationId: invitation.id,
        },
      });

      await tx.adminInvitation.update({
        where: { id: invitationId },
        data: {
          redeemedBy: session.user.id,
          redeemedAt: new Date(),
        },
      });
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADMIN_INVITATION_REDEEMED",
        resourceType: "AdminInvitation",
        resourceId: invitationId,
        metadata: { newRole: invitation.role },
      },
    });

    return NextResponse.json({ success: true, message: "Role updated successfully" });
  } catch (error) {
    console.error("Invitation redemption error:", error);
    return NextResponse.json({ error: "Failed to redeem invitation" }, { status: 500 });
  }
}