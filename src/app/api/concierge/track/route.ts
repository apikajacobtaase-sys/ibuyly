
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TrackSchema = z.object({
  productId: z.string().min(1),
  offerId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const body = TrackSchema.safeParse(await req.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid product interaction." },
        { status: 400 }
      );
    }

    const { productId, offerId } = body.data;

    // Verify the actual product, variant and seller offer.
    const offer = await db.sellerOffer.findFirst({
      where: {
        id: offerId,
        status: "ACTIVE",
        stockQuantity: { gt: 0 },
        variant: {
          isActive: true,
          productId,
          product: {
            status: "ACTIVE",
          },
        },
        seller: {
          isActive: true,
        },
      },
      select: {
        sellerId: true,
        variant: {
          select: {
            product: {
              select: {
                id: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: "This product offer is no longer available." },
        { status: 404 }
      );
    }

    await db.conciergeInteraction.create({
      data: {
        eventType: "PRODUCT_CLICK",
        userId: session.user.id,
        productId: offer.variant.product.id,
        sellerId: offer.sellerId,
        categoryId: offer.variant.product.categoryId,
      },
    });

    return NextResponse.json({
      success: true,
      tracked: true,
    });
  } catch (error) {
    console.error("Concierge click tracking error:", error);

    return NextResponse.json(
      { error: "Unable to record this interaction." },
      { status: 500 }
    );
  }
}