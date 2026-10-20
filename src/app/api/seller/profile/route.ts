// src/app/api/seller/profile/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// Strict validation matching your Prisma schema exactly
const updateProfileSchema = z.object({
  businessName: z.string().min(2, "Business name is required").max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  logoUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  businessType: z.string().max(50).optional().nullable(),
  paystackSubaccountCode: z.string().optional().nullable(),
  flutterwaveAccountId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    // 👇 SAFETY: Convert Prisma Decimal to float for JSON serialization
    const serializedProfile = {
      ...profile,
      commissionRate: parseFloat(profile.commissionRate.toString()),
    };

    return NextResponse.json({ profile: serializedProfile });
  } catch (error) {
    console.error("GET seller profile error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = validation.data;
    
    // 👇 SAFETY: Clean up empty strings to null before sending to Prisma
    const cleanData = {
      ...(data.businessName !== undefined && { businessName: data.businessName }),
      ...(data.description !== undefined && { description: data.description === "" ? null : data.description }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl === "" ? null : data.logoUrl }),
      ...(data.businessType !== undefined && { businessType: data.businessType === "" ? null : data.businessType }),
      ...(data.paystackSubaccountCode !== undefined && { paystackSubaccountCode: data.paystackSubaccountCode === "" ? null : data.paystackSubaccountCode }),
      ...(data.flutterwaveAccountId !== undefined && { flutterwaveAccountId: data.flutterwaveAccountId === "" ? null : data.flutterwaveAccountId }),
    };

    const updatedProfile = await db.sellerProfile.update({
      where: { userId: session.user.id },
      data: cleanData,
    });

    const serializedProfile = {
      ...updatedProfile,
      commissionRate: parseFloat(updatedProfile.commissionRate.toString()),
    };

    return NextResponse.json({ 
      success: true, 
      message: "Store setup saved successfully!",
      profile: serializedProfile 
    });
  } catch (error) {
    console.error("PATCH seller profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}