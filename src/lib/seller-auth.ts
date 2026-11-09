// src/lib/seller-auth.ts
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SellerPermission } from "@/lib/permissions";

const ACTIVE_SELLER_COOKIE = "ibuy_active_seller_id";

type SellerAccessResult =
  | {
      authorized: true;
      userId: string;
      sellerId: string;
      isOwner: boolean;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

function hasPermission(
  membership: {
    canManageProducts: boolean;
    canManageInventory: boolean;
    canManageOrders: boolean;
    canViewFinances: boolean;
    canManageReviews: boolean;
    canManageSettings: boolean;
  },
  permission: SellerPermission
): boolean {
  switch (permission) {
    case "manage_products":
      return membership.canManageProducts;
    case "manage_inventory":
      return membership.canManageInventory;
    case "manage_orders":
      return membership.canManageOrders;
    case "view_finances":
      return membership.canViewFinances;
    case "manage_reviews":
      return membership.canManageReviews;
    case "manage_settings":
      return membership.canManageSettings;
    default:
      return false;
  }
}

function denied(error: string, status: number): SellerAccessResult {
  return {
    authorized: false,
    response: NextResponse.json({ error }, { status }),
  };
}

export async function authorizeSeller(
  permission: SellerPermission,
  requestedSellerId?: string
): Promise<SellerAccessResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return denied("Authentication required", 401);
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
    return denied("Your account is inactive or unavailable.", 403);
  }

  const cookieStore = await cookies();
  const selectedCookie = cookieStore.get(ACTIVE_SELLER_COOKIE)?.value;

  // An explicitly requested store takes precedence, but is still
  // validated against the user's ownership or active membership.
  let sellerId = requestedSellerId || selectedCookie;

  // Automatically resolve accounts with exactly one eligible store.
  if (!sellerId) {
    const eligibleStores = await db.sellerProfile.findMany({
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
      select: { id: true },
      take: 2,
    });

    if (eligibleStores.length === 0) {
      return denied("No approved seller access", 403);
    }

    if (eligibleStores.length > 1) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "Please select a seller store before continuing.",
            code: "STORE_SELECTION_REQUIRED",
          },
          { status: 409 }
        ),
      };
    }

    sellerId = eligibleStores[0].id;
  }

  // Validate ownership of the exact selected store.
  const ownedSeller = await db.sellerProfile.findFirst({
    where: {
      id: sellerId,
      userId,
      isActive: true,
      verificationStatus: "VERIFIED",
    },
    select: { id: true },
  });

  if (ownedSeller) {
    return {
      authorized: true,
      userId,
      sellerId: ownedSeller.id,
      isOwner: true,
    };
  }

  // Otherwise, validate an active membership and its permissions.
  const membership = await db.sellerMembership.findFirst({
    where: {
      userId,
      sellerId,
      isActive: true,
      seller: {
        isActive: true,
        verificationStatus: "VERIFIED",
      },
    },
    select: {
      sellerId: true,
      canManageProducts: true,
      canManageInventory: true,
      canManageOrders: true,
      canViewFinances: true,
      canManageReviews: true,
      canManageSettings: true,
    },
  });

  if (!membership) {
    return denied("No approved access to the selected seller store.", 403);
  }

  if (!hasPermission(membership, permission)) {
    return denied("Insufficient seller permissions", 403);
  }

  return {
    authorized: true,
    userId,
    sellerId: membership.sellerId,
    isOwner: false,
  };
}