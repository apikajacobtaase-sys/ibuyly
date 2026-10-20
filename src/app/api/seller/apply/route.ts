// src/app/api/seller/apply/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessName, businessType, description } = await req.json();

    if (!businessName || !businessType || !description) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Check if user already has a seller profile or pending application
    const existingProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (existingProfile) {
      return NextResponse.json({ error: "You already have a seller account" }, { status: 400 });
    }

    const existingApplication = await db.sellerApplication.findFirst({
      where: { 
        userId: session.user.id,
        status: { in: ["PENDING", "UNDER_REVIEW", "NEEDS_INFO"] }
      },
    });

    if (existingApplication) {
      return NextResponse.json({ error: "You already have a pending application" }, { status: 400 });
    }

    // Create application
    const application = await db.sellerApplication.create({
      data: {
        userId: session.user.id,
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        description: description.trim(),
        status: "PENDING",
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SELLER_APPLICATION_SUBMITTED",
        resourceType: "SellerApplication",
        resourceId: application.id,
        metadata: { businessName },
      },
    });

    return NextResponse.json({ success: true, applicationId: application.id }, { status: 201 });
  } catch (error) {
    console.error("Seller application error:", error);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}