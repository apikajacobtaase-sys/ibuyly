// src/app/api/admin/applications/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendSellerNotificationEmail } from "@/lib/email";
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const applications = await db.sellerApplication.findMany({
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        sellerProfile: { select: { id: true, verificationStatus: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      applications: applications.map((a) => ({
        id: a.id,
        businessName: a.businessName,
        businessType: a.businessType,
        description: a.description,
        documents: a.documents,
        status: a.status,
        rejectionReason: a.rejectionReason,
        adminNotes: a.adminNotes,
        userEmail: a.user.email,
        userName: `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim(),
        hasSellerProfile: !!a.sellerProfile,
        createdAt: a.createdAt,
        reviewedAt: a.reviewedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { applicationId, action, reason, notes } = await req.json();

    const application = await db.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { user: true, sellerProfile: true },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (action === "APPROVE") {
      await db.$transaction(async (tx) => {
        let sellerProfileId = application.sellerProfile?.id;

        // 1. Create SellerProfile if it doesn't exist
        if (!sellerProfileId) {
          const newProfile = await tx.sellerProfile.create({
            data: {
              userId: application.userId,
              businessName: application.businessName,
              businessType: application.businessType,
              description: application.description,
              verificationStatus: "VERIFIED",
              verifiedAt: new Date(),
            },
          });
          sellerProfileId = newProfile.id;
        } else {
          // Update existing profile to VERIFIED
          await tx.sellerProfile.update({
            where: { id: sellerProfileId },
            data: { verificationStatus: "VERIFIED", verifiedAt: new Date() },
          });
        }

        // 2. Create or Update SellerMembership as OWNER with full permissions
        await tx.sellerMembership.upsert({
          where: {
            userId_sellerId: {
              userId: application.userId,
              sellerId: sellerProfileId,
            },
          },
          update: {
            role: "OWNER",
            canManageProducts: true,
            canManageInventory: true,
            canManageOrders: true,
            canViewFinances: true,
            canManageReviews: true,
            canManageSettings: true,
            isActive: true,
          },
          create: {
            userId: application.userId,
            sellerId: sellerProfileId,
            role: "OWNER",
            canManageProducts: true,
            canManageInventory: true,
            canManageOrders: true,
            canViewFinances: true,
            canManageReviews: true,
            canManageSettings: true,
            isActive: true,
          },
        });

        // 3. Update Application status
        await tx.sellerApplication.update({
          where: { id: applicationId },
          data: {
            status: "APPROVED",
            sellerProfileId,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            adminNotes: notes || null,
          },
        });
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SELLER_APPLICATION_APPROVED",
          resourceType: "SellerApplication",
          resourceId: applicationId,
          metadata: { businessName: application.businessName },
        },
      });

      // ✅ Send APPROVAL email notification
      await sendSellerNotificationEmail({
        to: application.user.email,
        businessName: application.businessName,
        status: "APPROVED",
      });

    } else if (action === "REJECT") {
      if (!reason) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      await db.sellerApplication.update({
        where: { id: applicationId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          adminNotes: notes || null,
        },
      });

      await logAudit({
        userId: session.user.id,
        action: "SELLER_APPLICATION_REJECTED",
        resourceType: "SellerApplication",
        resourceId: applicationId,
        metadata: { reason },
      });

      // ✅ Send REJECTION email notification
      await sendSellerApplicationEmail({
        to: application.user.email,
        businessName: application.businessName,
        status: "REJECTED",
        reason: reason,
      });

    } else if (action === "NEEDS_INFO") {
      await db.sellerApplication.update({
        where: { id: applicationId },
        data: {
          status: "NEEDS_INFO",
          adminNotes: notes || "Additional information requested",
        },
      });

      await logAudit({
        userId: session.user.id,
        action: "SELLER_APPLICATION_INFO_REQUESTED",
        resourceType: "SellerApplication",
        resourceId: applicationId,
      });

      // ✅ Send NEEDS INFO email notification
      await sendSellerApplicationEmail({
        to: application.user.email,
        businessName: application.businessName,
        status: "MORE_INFORMATION_REQUIRED",
        reason: notes || "Please provide additional documentation.",
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Application action error:", error);
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 });
  }
}