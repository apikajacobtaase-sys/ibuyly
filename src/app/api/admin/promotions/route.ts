// src/app/api/admin/promotions/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isAdmin(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const vouchers = await db.voucher.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      vouchers: vouchers.map((v) => ({
        ...v,
        value: parseFloat(v.value.toString()),
        minOrderAmount: v.minOrderAmount ? parseFloat(v.minOrderAmount.toString()) : null,
        maxDiscount: v.maxDiscount ? parseFloat(v.maxDiscount.toString()) : null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch vouchers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isAdmin(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    
    const voucher = await db.voucher.create({
      data: {
        code: body.code.toUpperCase().trim(),
        description: body.description,
        type: body.type,
        value: parseFloat(body.value),
        minOrderAmount: body.minOrderAmount ? parseFloat(body.minOrderAmount) : null,
        maxDiscount: body.maxDiscount ? parseFloat(body.maxDiscount) : null,
        usageLimit: body.usageLimit ? parseInt(body.usageLimit) : null,
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "VOUCHER_CREATED",
        resourceType: "Voucher",
        resourceId: voucher.id,
        metadata: { code: voucher.code },
      },
    });

    return NextResponse.json({ success: true, voucher }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A voucher with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create voucher" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isAdmin(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id, isActive } = await req.json();

    await db.voucher.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update voucher" }, { status: 500 });
  }
}