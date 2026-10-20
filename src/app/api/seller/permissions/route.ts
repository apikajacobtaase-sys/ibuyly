// src/app/api/seller/permissions/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is seller owner
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (sellerProfile) {
      // Owner has all permissions
      return NextResponse.json({
        permissions: {
          canManageProducts: true,
          canManageInventory: true,
          canManageOrders: true,
          canViewFinances: true,
          canManageReviews: true,
          canManageSettings: true,
          isOwner: true,
        },
      });
    }

    // Check membership
    const membership = await db.sellerMembership.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (membership) {
      return NextResponse.json({
        permissions: {
          canManageProducts: membership.canManageProducts,
          canManageInventory: membership.canManageInventory,
          canManageOrders: membership.canManageOrders,
          canViewFinances: membership.canViewFinances,
          canManageReviews: membership.canManageReviews,
          canManageSettings: membership.canManageSettings,
          isOwner: false,
        },
      });
    }

    // No seller access
    return NextResponse.json({
      permissions: null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}