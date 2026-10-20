// src/app/api/seller/staff/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get the seller profile this user owns
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Not a seller owner" }, { status: 403 });
    }

    const memberships = await db.sellerMembership.findMany({
      where: { sellerId: sellerProfile.id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      staff: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: `${m.user.firstName || ""} ${m.user.lastName || ""}`.trim() || m.user.email,
        role: m.role,
        permissions: {
          canManageProducts: m.canManageProducts,
          canManageInventory: m.canManageInventory,
          canManageOrders: m.canManageOrders,
          canViewFinances: m.canViewFinances,
          canManageReviews: m.canManageReviews,
          canManageSettings: m.canManageSettings,
        },
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Not a seller owner" }, { status: 403 });
    }

    const { email, permissions } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!targetUser) {
      return NextResponse.json({ error: "User with this email does not exist" }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: "You cannot add yourself as staff" }, { status: 400 });
    }

    // Check if already a member
    const existing = await db.sellerMembership.findUnique({
      where: {
        userId_sellerId: {
          userId: targetUser.id,
          sellerId: sellerProfile.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "User is already a member of this store" }, { status: 400 });
    }

    // Create membership
    const membership = await db.sellerMembership.create({
      data: {
        userId: targetUser.id,
        sellerId: sellerProfile.id,
        role: "STAFF",
        canManageProducts: permissions?.canManageProducts || false,
        canManageInventory: permissions?.canManageInventory || false,
        canManageOrders: permissions?.canManageOrders || false,
        canViewFinances: permissions?.canViewFinances || false,
        canManageReviews: permissions?.canManageReviews || false,
        canManageSettings: permissions?.canManageSettings || false,
        isActive: true,
        invitedBy: session.user.id,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SELLER_STAFF_ADDED",
        resourceType: "SellerMembership",
        resourceId: membership.id,
        metadata: { targetEmail: email, sellerId: sellerProfile.id },
      },
    });

    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (error) {
    console.error("Add staff error:", error);
    return NextResponse.json({ error: "Failed to add staff member" }, { status: 500 });
  }
}