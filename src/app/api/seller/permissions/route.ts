// src/app/api/seller/permissions/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

const ACTIVE_SELLER_COOKIE = "ibuy_active_seller_id";

const ownerPermissions = {
  canManageProducts: true,
  canManageInventory: true,
  canManageOrders: true,
  canViewFinances: true,
  canManageReviews: true,
  canManageSettings: true,
  isOwner: true,
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        accountStatus: true,
      },
    });

    if (
      !currentUser ||
      !currentUser.isActive ||
      currentUser.accountStatus !== "ACTIVE"
    ) {
      return NextResponse.json(
        { error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const stores = await db.sellerProfile.findMany({
      where: {
        isActive: true,
        verificationStatus: "VERIFIED",
        OR: [
          { userId },
          {
            memberships: {
              some: {
                userId,
                isActive: true,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (stores.length === 0) {
      return NextResponse.json({ permissions: null });
    }

    const cookieStore = await cookies();
    const selectedCookie = cookieStore.get(ACTIVE_SELLER_COOKIE)?.value;

    const selectedStore =
      selectedCookie !== undefined
        ? stores.find((store) => store.id === selectedCookie) ?? null
        : stores.length === 1
          ? stores[0]
          : null;

    if (!selectedStore) {
      return NextResponse.json({
        permissions: null,
        requiresStoreSelection: true,
        sellerIds: stores.map((store) => store.id),
      });
    }

    if (selectedStore.userId === userId) {
      return NextResponse.json({
        sellerId: selectedStore.id,
        permissions: ownerPermissions,
      });
    }

    const membership = await db.sellerMembership.findFirst({
      where: {
        userId,
        sellerId: selectedStore.id,
        isActive: true,
        seller: {
          isActive: true,
          verificationStatus: "VERIFIED",
        },
      },
      select: {
        canManageProducts: true,
        canManageInventory: true,
        canManageOrders: true,
        canViewFinances: true,
        canManageReviews: true,
        canManageSettings: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No approved access to the selected seller store." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      sellerId: selectedStore.id,
      permissions: {
        ...membership,
        isOwner: false,
      },
    });
  } catch (error) {
    console.error("Fetch seller permissions error:", error);

    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}