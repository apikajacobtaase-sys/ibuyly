// src/app/api/seller/settings/route.ts
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

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { email: true, phone: true, firstName: true, lastName: true } },
      },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      seller: {
        id: sellerProfile.id,
        businessName: sellerProfile.businessName,
        businessType: sellerProfile.businessType,
        description: sellerProfile.description,
        logoUrl: sellerProfile.logoUrl,
        verificationStatus: sellerProfile.verificationStatus,
        commissionRate: parseFloat(sellerProfile.commissionRate.toString()),
        userEmail: sellerProfile.user.email,
        userPhone: sellerProfile.user.phone,
        userName: `${sellerProfile.user.firstName || ""} ${sellerProfile.user.lastName || ""}`.trim(),
        createdAt: sellerProfile.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    const { businessName, businessType, description, logoUrl } = await req.json();

    const updated = await db.sellerProfile.update({
      where: { id: sellerProfile.id },
      data: {
        businessName: businessName?.trim() || sellerProfile.businessName,
        businessType: businessType?.trim() || null,
        description: description?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, seller: updated });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}