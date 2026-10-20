// src/lib/permissions.ts
import { db } from "@/lib/db";

export type SellerPermission = 
  | "manage_products"
  | "manage_inventory"
  | "manage_orders"
  | "view_finances"
  | "manage_reviews"
  | "manage_settings";

export async function checkSellerPermission(
  userId: string,
  sellerId: string,
  permission: SellerPermission
): Promise<boolean> {
  // Check if user is the seller owner
  const sellerProfile = await db.sellerProfile.findUnique({
    where: { id: sellerId, userId },
  });

  if (sellerProfile) {
    return true; // Owner has all permissions
  }

  // Check membership permissions
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

export async function getUserSellerIds(userId: string): Promise<string[]> {
  // Get seller profile if user is owner
  const sellerProfile = await db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  const sellerIds: string[] = [];
  if (sellerProfile) {
    sellerIds.push(sellerProfile.id);
  }

  // Get memberships
  const memberships = await db.sellerMembership.findMany({
    where: { userId, isActive: true },
    select: { sellerId: true },
  });

  sellerIds.push(...memberships.map((m) => m.sellerId));

  return sellerIds;
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}