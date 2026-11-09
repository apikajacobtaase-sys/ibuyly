// src/app/api/seller/stores/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Revalidate account status before exposing seller stores.
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

    // Find every active, verified store the user owns or belongs to.
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
        businessName: true,
        businessType: true,
        logoUrl: true,
        verificationStatus: true,
        userId: true,
        memberships: {
          where: {
            userId,
            isActive: true,
          },
          select: {
            role: true,
            canManageProducts: true,
            canManageInventory: true,
            canManageOrders: true,
            canViewFinances: true,
            canManageReviews: true,
            canManageSettings: true,
          },
        },
      },
      orderBy: {
        businessName: "asc",
      },
    });

    const result = stores.map((store) => {
      const isOwner = store.userId === userId;
      const membership = store.memberships[0];

      return {
        id: store.id,
        businessName: store.businessName,
        businessType: store.businessType,
        logoUrl: store.logoUrl,
        verificationStatus: store.verificationStatus,
        accessRole: isOwner ? "OWNER" : membership?.role ?? "STAFF",
        isOwner,
        permissions: {
          canManageProducts: isOwner || !!membership?.canManageProducts,
          canManageInventory: isOwner || !!membership?.canManageInventory,
          canManageOrders: isOwner || !!membership?.canManageOrders,
          canViewFinances: isOwner || !!membership?.canViewFinances,
          canManageReviews: isOwner || !!membership?.canManageReviews,
          canManageSettings: isOwner || !!membership?.canManageSettings,
        },
      };
    });

    const cookieStore = await cookies();
    const selectedCookie =
      cookieStore.get("ibuy_active_seller_id")?.value;

    const validSelectedStoreId =
      selectedCookie !== undefined
        ? result.some((store) => store.id === selectedCookie)
          ? selectedCookie
          : null
        : result.length === 1
          ? result[0].id
          : null;

    return NextResponse.json({
      stores: result,
      count: result.length,
      selectedStoreId: validSelectedStoreId,
    });
  } catch (error) {
    console.error("Fetch seller stores error:", error);

    return NextResponse.json(
      { error: "Failed to fetch seller stores" },
      { status: 500 }
    );
  }
}
