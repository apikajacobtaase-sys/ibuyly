import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(100).optional(),
  businessType: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  logoUrl: z.literal("").optional(),
}).strict().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: "At least one setting must be provided" }
);

const settingsSelect = {
  id: true,
  businessName: true,
  businessType: true,
  description: true,
  logoUrl: true,
  verificationStatus: true,
  isActive: true,
  commissionRate: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
} as const;

function serializeSeller(seller: NonNullable<Awaited<ReturnType<typeof findSeller>>>) {
  const { user, commissionRate, ...store } = seller;

  return {
    ...store,
    commissionRate: Number(commissionRate),
    userName: [user.firstName, user.lastName].filter(Boolean).join(" "),
    userEmail: user.email,
    userPhone: user.phone,
  };
}

function findSeller(id: string) {
  return db.sellerProfile.findUnique({
    where: { id },
    select: settingsSelect,
  });
}

export async function GET() {
  try {
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    const seller = await findSeller(access.sellerId);

    if (!seller) {
      return NextResponse.json(
        { error: "Seller profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ seller: serializeSeller(seller) });
  } catch (error) {
    console.error("Fetch seller settings error:", error);

    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the store owner can update store settings" },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid settings",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const cleanData = {
      ...(data.businessName !== undefined && {
        businessName: data.businessName,
      }),
      ...(data.businessType !== undefined && {
        businessType: data.businessType === "" ? null : data.businessType,
      }),
      ...(data.description !== undefined && {
        description: data.description === "" ? null : data.description,
      }),
      ...(data.logoUrl !== undefined && {
        logoUrl: data.logoUrl === "" ? null : data.logoUrl,
      }),
    };

    const updated = await db.sellerProfile.updateMany({
      where: {
        id: access.sellerId,
        userId: access.userId,
        isActive: true,
        verificationStatus: "VERIFIED",
      },
      data: cleanData,
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Store settings could not be updated" },
        { status: 409 }
      );
    }

    const seller = await findSeller(access.sellerId);

    if (!seller) {
      return NextResponse.json(
        { error: "Seller profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Store settings updated successfully",
      seller: serializeSeller(seller),
    });
  } catch (error) {
    console.error("Update seller settings error:", error);

    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
