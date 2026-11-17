 import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    const banners = await db.promotionBanner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        mobileImageUrl: true,
        altText: true,
        buttonText: true,
        buttonUrl: true,
        placement: true,
      },
    });

    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Public banners error:", error);
    return NextResponse.json({ error: "Failed to load banners" }, { status: 500 });
  }
}