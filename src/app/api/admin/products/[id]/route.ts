// src/app/api/admin/products/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            businessName: true,
            verificationStatus: true,
            user: { select: { email: true } },
          },
        },
        category: { select: { name: true } },
        variants: true,
        images: { orderBy: { sortOrder: "asc" } },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { status, feedback } = await req.json();

    const validStatuses = ["ACTIVE", "DRAFT", "ARCHIVED", "OUT_OF_STOCK"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await db.product.update({
      where: { id },
      data: { status },
    });

    // Log the moderation action
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: `PRODUCT_${status}`,
        resourceType: "Product",
        resourceId: id,
        metadata: feedback ? { feedback } : {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product moderation error:", error);
    return NextResponse.json({ error: "Failed to moderate product" }, { status: 500 });
  }
}