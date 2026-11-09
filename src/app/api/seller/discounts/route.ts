import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const CreateDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(20)
      .transform((value) =>
        value.toUpperCase().replace(/\s+/g, "_")
      )
      .refine(
        (value) => /^[A-Z0-9_-]+$/.test(value),
        "Discount code can only contain letters, numbers, underscores and hyphens."
      ),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: z.number().finite().positive(),
    minOrderAmount: z.number().finite().nonnegative().nullable().optional(),
    maxDiscount: z.number().finite().positive().nullable().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Percentage discount cannot exceed 100.",
      });
    }

    if (data.type === "FIXED_AMOUNT" && data.maxDiscount != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxDiscount"],
        message: "Maximum discount is only applicable to percentage discounts.",
      });
    }

    if (
      data.expiresAt &&
      new Date(data.expiresAt).getTime() <= Date.now()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiry date must be in the future.",
      });
    }
  });

export async function GET() {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    const discounts = await db.discountCode.findMany({
      where: { sellerId: access.sellerId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      discounts: discounts.map((discount) => ({
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: Number(discount.value),
        minOrderAmount:
          discount.minOrderAmount != null
            ? Number(discount.minOrderAmount)
            : null,
        maxDiscount:
          discount.maxDiscount != null
            ? Number(discount.maxDiscount)
            : null,
        usageLimit: discount.usageLimit,
        usedCount: discount.usedCount,
        startsAt: discount.startsAt,
        expiresAt: discount.expiresAt,
        isActive: discount.isActive,
      })),
    });
  } catch (error) {
    console.error("Seller discounts GET error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve discounts." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = CreateDiscountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid discount details.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      code,
      type,
      value,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      expiresAt,
    } = validation.data;

    const existing = await db.discountCode.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This discount code already exists." },
        { status: 409 }
      );
    }

    const discount = await db.discountCode.create({
      data: {
        sellerId: access.sellerId,
        code,
        type,
        value,
        minOrderAmount: minOrderAmount ?? null,
        maxDiscount: maxDiscount ?? null,
        usageLimit: usageLimit ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { success: true, discountId: discount.id },
      { status: 201 }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This discount code already exists." },
        { status: 409 }
      );
    }

    console.error("Seller discounts POST error:", error);

    return NextResponse.json(
      { error: "Unable to create discount." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await authorizeSeller("manage_products");

    if (!access.authorized) {
      return access.response;
    }

    const { searchParams } = new URL(req.url);
    const discountId = searchParams.get("id");

    if (!discountId || discountId.length > 191) {
      return NextResponse.json(
        { error: "A valid discount ID is required." },
        { status: 400 }
      );
    }

    const result = await db.discountCode.deleteMany({
      where: {
        id: discountId,
        sellerId: access.sellerId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Discount not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller discounts DELETE error:", error);

    return NextResponse.json(
      { error: "Unable to delete discount." },
      { status: 500 }
    );
  }
}