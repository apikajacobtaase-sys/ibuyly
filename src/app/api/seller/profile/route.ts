import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const updateProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  businessType: z.string().trim().max(50).nullable().optional(),
}).strict().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: "At least one field must be provided" }
);

const profileSelect = {
  id: true,
  businessName: true,
  description: true,
  logoUrl: true,
  businessType: true,
  verificationStatus: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    const profile = await db.sellerProfile.findUnique({
      where: { id: access.sellerId },
      select: profileSelect,
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Seller profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET seller profile error:", error);

    return NextResponse.json(
      { error: "Failed to fetch profile" },
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
        { error: "Only the store owner can update store profile details" },
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

    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid profile data",
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
      ...(data.description !== undefined && {
        description: data.description === "" ? null : data.description,
      }),
      ...(data.businessType !== undefined && {
        businessType: data.businessType === "" ? null : data.businessType,
      }),
    };

    const updatedProfile = await db.sellerProfile.updateMany({
      where: {
        id: access.sellerId,
        userId: access.userId,
        isActive: true,
        verificationStatus: "VERIFIED",
      },
      data: cleanData,
    });

    if (updatedProfile.count !== 1) {
      return NextResponse.json(
        { error: "Seller profile could not be updated" },
        { status: 409 }
      );
    }

    const profile = await db.sellerProfile.findUnique({
      where: { id: access.sellerId },
      select: profileSelect,
    });

    return NextResponse.json({
      success: true,
      message: "Store profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("PATCH seller profile error:", error);

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
