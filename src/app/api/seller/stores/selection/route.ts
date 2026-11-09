// src/app/api/seller/stores/selection/route.ts
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const ACTIVE_SELLER_COOKIE = "ibuy_active_seller_id";

export async function POST(request: NextRequest) {
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

    const body: unknown = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      !("sellerId" in body) ||
      typeof body.sellerId !== "string" ||
      !body.sellerId.trim() ||
      body.sellerId.length > 191
    ) {
      return NextResponse.json(
        { error: "A valid seller ID is required." },
        { status: 400 }
      );
    }

    const sellerId = body.sellerId.trim();

    const seller = await db.sellerProfile.findFirst({
      where: {
        id: sellerId,
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
      },
    });

    if (!seller) {
      return NextResponse.json(
        { error: "You do not have access to this seller store." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      selectedStore: {
        id: seller.id,
        businessName: seller.businessName,
      },
    });

    response.cookies.set(ACTIVE_SELLER_COOKIE, seller.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("Select seller store error:", error);

    return NextResponse.json(
      { error: "Failed to select seller store." },
      { status: 500 }
    );
  }
}