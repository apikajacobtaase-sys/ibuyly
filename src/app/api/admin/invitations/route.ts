// src/app/api/admin/invitations/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !["ADMIN", "SUPPORT"].includes(role)) {
      return NextResponse.json({ error: "Valid email and role (ADMIN or SUPPORT) are required" }, { status: 400 });
    }

    // Check if invitation already exists and is active
    const existing = await db.adminInvitation.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        redeemedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "An active invitation for this email already exists" }, { status: 409 });
    }

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    
    // Set expiration to 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = await db.adminInvitation.create({
      data: {
        email: email.toLowerCase().trim(),
        role,
        tokenHash,
        invitedBy: session.user.id,
        expiresAt,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ADMIN_INVITATION_CREATED",
        resourceType: "AdminInvitation",
        resourceId: invitation.id,
        metadata: { targetEmail: email, role },
      },
    });

    // In production, send this rawToken via email. 
    // For dev, we return it so you can test the flow.
    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json({
      success: true,
      invitationId: invitation.id,
      ...(isDev && { devRawToken: rawToken }),
      message: "Invitation created successfully.",
    }, { status: 201 });
  } catch (error) {
    console.error("Invitation creation error:", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const invitations = await db.adminInvitation.findMany({
      include: {
        inviter: { select: { email: true } },
        redeemedUser: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.revokedAt ? "REVOKED" : inv.redeemedAt ? "REDEEMED" : inv.expiresAt < new Date() ? "EXPIRED" : "PENDING",
        inviterEmail: inv.inviter.email,
        redeemedEmail: inv.redeemedUser?.email || null,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}