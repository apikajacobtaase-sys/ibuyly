// src/app/api/admin/sellers/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { getSellerWelcomeEmail } from "@/emails/welcome-seller";
const UpdateSellerSchema = z.object({
  sellerId: z.string().cuid("Invalid seller ID"),
  status: z.enum(["VERIFIED", "REJECTED", "SUSPENDED", "PENDING"]),
  reason: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    // 🔍 THIS MUST CALL requireAdmin
    const { user, error } = await requireAdmin();
    if (error) {
      console.log("🚨 requireAdmin returned error:", error);
      return error;
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (status && status !== "ALL") {
      whereClause.verificationStatus = status;
    }

    if (search) {
      whereClause.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [sellers, total] = await Promise.all([
      db.sellerProfile.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.sellerProfile.count({ where: whereClause }),
    ]);

    const statusCounts = await db.$queryRaw<any[]>`
      SELECT 
        verification_status as status,
        COUNT(*)::int as count
      FROM seller_profiles
      GROUP BY verification_status
    `;

    const counts: Record<string, number> = {
      ALL: total,
      PENDING: 0,
      VERIFIED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
    };
    statusCounts.forEach((row: any) => {
      counts[row.status] = Number(row.count);
    });

    const formattedSellers = sellers.map((s: any) => ({
      id: s.id,
      businessName: s.businessName,
      businessType: s.businessType,
      description: s.description,
      logoUrl: s.logoUrl,
      verificationStatus: s.verificationStatus,
      verifiedAt: s.verifiedAt,
      isActive: s.isActive,
      commissionRate: Number(s.commissionRate),
      createdAt: s.createdAt,
      productCount: s._count.products,
      owner: {
        id: s.user.id,
        email: s.user.email,
        phone: s.user.phone,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        avatarUrl: s.user.avatarUrl,
        fullName: [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || "Unknown",
      },
    }));

    return NextResponse.json({
      sellers: formattedSellers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts,
    });
  } catch (error: any) {
    console.error("🚨 Admin sellers list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sellers" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdateSellerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { sellerId, status, reason } = validation.data;

    const seller = await db.sellerProfile.findUnique({
      where: { id: sellerId },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (seller.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own seller status" },
        { status: 400 }
      );
    }

    const updateData: any = {
      verificationStatus: status,
    };

    if (status === "VERIFIED") {
      updateData.verifiedAt = new Date();
      updateData.isActive = true;
    } else if (status === "SUSPENDED" || status === "REJECTED") {
      updateData.isActive = false;
    }

    await db.sellerProfile.update({
      where: { id: sellerId },
      data: updateData,
    });

    let title = "";
    let message = "";

    if (status === "VERIFIED") {
      title = "🎉 Your seller account has been approved!";
      message = "Welcome to iBUY! You can now publish products and start selling.";
    } else if (status === "REJECTED") {
      title = "Your seller application was not approved";
      message = reason
        ? `Reason: ${reason}. Please contact support for more information.`
        : "Unfortunately, your application was not approved at this time.";
    } else if (status === "SUSPENDED") {
      title = "⚠️ Your seller account has been suspended";
      message = reason ? `Reason: ${reason}.` : "Your account has been suspended.";
    } else if (status === "PENDING") {
      title = "Your seller account is under review";
      message = "Your account status has been reset to pending review.";
    }


    
    await db.notification.create({
      data: {
        userId: seller.userId,
        sellerId: seller.id,
        type: "SYSTEM",
        title,
        message,
        link: "/seller",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Seller ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error("🚨 Admin update seller error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update seller" },
      { status: 500 }
    );
  }
}