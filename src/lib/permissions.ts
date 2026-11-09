// src/lib/permissions.ts
import { db } from "@/lib/db";

export type SellerPermission =
  | "manage_products"
  | "manage_inventory"
  | "manage_orders"
  | "view_finances"
  | "manage_reviews"
  | "manage_settings";

/**
 * A seller must be active and verified before anyone
 * can exercise seller permissions.
 *
 * User.role does not grant seller access.
 */
export async function checkSellerPermission(
  userId: string,
  sellerId: string,
  permission: SellerPermission
): Promise<boolean> {
  // Verify that the seller exists, is active and approved.
  const sellerProfile = await db.sellerProfile.findFirst({
    where: {
      id: sellerId,
      isActive: true,
      verificationStatus: "VERIFIED",
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!sellerProfile) {
    return false;
  }

  // The verified seller owner has all seller permissions.
  if (sellerProfile.userId === userId) {
    return true;
  }

  // Staff must have an active membership and explicit permission.
  const membership = await db.sellerMembership.findUnique({
    where: {
      userId_sellerId: {
        userId,
        sellerId,
      },
    },
  });

  if (!membership || !membership.isActive) {
    return false;
  }

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

/**
 * Returns only verified, active seller stores to which
 * the user has an active owner or staff relationship.
 */
export async function getUserSellerIds(
  userId: string
): Promise<string[]> {
  const [ownedProfiles, memberships] = await Promise.all([
    db.sellerProfile.findMany({
      where: {
        userId,
        isActive: true,
        verificationStatus: "VERIFIED",
      },
      select: {
        id: true,
      },
    }),

    db.sellerMembership.findMany({
      where: {
        userId,
        isActive: true,
        seller: {
          isActive: true,
          verificationStatus: "VERIFIED",
        },
      },
      select: {
        sellerId: true,
      },
    }),
  ]);

  return Array.from(
    new Set([
      ...ownedProfiles.map((profile) => profile.id),
      ...memberships.map((membership) => membership.sellerId),
    ])
  );
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}