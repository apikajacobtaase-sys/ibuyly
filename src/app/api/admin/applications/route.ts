import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { sendSellerApplicationEmail } from "@/lib/email";

const QuestionSchema = z.object({
  id: z.string().min(1).max(80),
  question: z.string().trim().min(3).max(500),
  type: z.enum(["SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE"]),
});

const ReviewSchema = z.object({
  applicationId: z.string().min(1).max(100),
  action: z.enum(["APPROVE", "REJECT", "NEEDS_INFO"]),
  reason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  questions: z.array(QuestionSchema).max(20).optional(),
});

const REVIEWABLE_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "NEEDS_INFO",
];

class ApplicationReviewError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ApplicationReviewError";
  }
}

export async function GET() {
  try {
    const { error } = await requireAdmin();

    if (error) return error;

    const applications = await db.sellerApplication.findMany({
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sellerProfile: {
          select: {
            id: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      applications: applications.map((application) => ({
        id: application.id,
        businessName: application.businessName,
        businessType: application.businessType,
        description: application.description,
        documents: application.documents,
        status: application.status,
        rejectionReason: application.rejectionReason,
        adminNotes: application.adminNotes,
        requestedQuestions: application.requestedQuestions,
        submittedAnswers: application.submittedAnswers,
        userEmail: application.user.email,
        userName: `${application.user.firstName || ""} ${application.user.lastName || ""}`.trim(),
        hasSellerProfile: !!application.sellerProfile,
        createdAt: application.createdAt,
        reviewedAt: application.reviewedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch seller applications:", error);

    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();

    if (error) return error;

    const body = await req.json();
    const validation = ReviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid review data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { applicationId, action, reason, notes, questions } = validation.data;

    if (action === "NEEDS_INFO" && (!questions || questions.length === 0)) {
      return NextResponse.json(
        { error: "Add at least one question before requesting information." },
        { status: 400 }
      );
    }

    if (action === "APPROVE" || action === "REJECT") {
      if (user.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Only SUPER_ADMIN can approve or reject seller applications" },
          { status: 403 }
        );
      }
    }

    if (action === "REJECT" && !reason) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 400 }
      );
    }

    const reviewedAt = new Date();

    const result = await db.$transaction(
      async (tx) => {
        const application = await tx.sellerApplication.findUnique({
          where: { id: applicationId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            sellerProfile: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        });

        if (!application) {
          throw new ApplicationReviewError(
            "Application not found",
            404
          );
        }

        if (!REVIEWABLE_STATUSES.includes(application.status)) {
          throw new ApplicationReviewError(
            "This application has already been reviewed and cannot be processed again",
            409
          );
        }

        const claimed = await tx.sellerApplication.updateMany({
          where: {
            id: applicationId,
            status: { in: REVIEWABLE_STATUSES },
          },
          data: {
            status: action === "APPROVE"
              ? "APPROVED"
              : action === "REJECT"
                ? "REJECTED"
                : "NEEDS_INFO",
            reviewedBy: user.id,
            reviewedAt,
            ...(action === "APPROVE"
              ? {
                  rejectionReason: null,
                  adminNotes: notes || null,
                }
              : action === "REJECT"
                ? {
                    rejectionReason: reason,
                    adminNotes: notes || null,
                  }
                : {
                    adminNotes: notes || "Additional information requested",
                    requestedQuestions: questions || [],
                    submittedAnswers: [],
                  }),
          },
        });

        if (claimed.count !== 1) {
          throw new ApplicationReviewError(
            "This application has already been processed",
            409
          );
        }

        let sellerProfileId: string | null = null;

        if (action === "APPROVE") {
          if (application.sellerProfile) {
            if (application.sellerProfile.userId !== application.userId) {
              throw new ApplicationReviewError(
                "Seller profile ownership mismatch",
                409
              );
            }

            sellerProfileId = application.sellerProfile.id;

            await tx.sellerProfile.update({
              where: { id: sellerProfileId },
              data: {
                verificationStatus: "VERIFIED",
                verifiedAt: reviewedAt,
                isActive: true,
              },
            });
          } else {
            const existingProfile = await tx.sellerProfile.findUnique({
              where: { userId: application.userId },
              select: { id: true },
            });

            if (existingProfile) {
              throw new ApplicationReviewError(
                "This applicant already has a seller profile. Manual reconciliation is required.",
                409
              );
            }

            const profile = await tx.sellerProfile.create({
              data: {
                userId: application.userId,
                businessName: application.businessName,
                businessType: application.businessType,
                description: application.description,
                verificationStatus: "VERIFIED",
                verifiedAt: reviewedAt,
                isActive: true,
              },
            });

            sellerProfileId = profile.id;
          }

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

          await tx.sellerApplication.update({
            where: { id: applicationId },
            data: { sellerProfileId },
          });
        }

        return {
          userId: application.user.id,
          businessName: application.businessName,
          email: application.user.email,
          status: action,
          sellerProfileId,
          reason:
            action === "REJECT"
              ? reason
              : action === "NEEDS_INFO"
                ? notes || questions?.map((item) => item.question).join("; ") || "Please provide additional documentation."
                : undefined,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    await logAudit({
      userId: user.id,
      action:
        action === "APPROVE"
          ? "SELLER_APPLICATION_APPROVED"
          : action === "REJECT"
            ? "SELLER_APPLICATION_REJECTED"
            : "SELLER_APPLICATION_INFO_REQUESTED",
      resourceType: "SellerApplication",
      resourceId: applicationId,
      metadata: {
        businessName: result.businessName,
        action,
        ...(action === "REJECT" ? { reason } : {}),
        ...(notes ? { notes } : {}),
        ...(result.sellerProfileId
          ? { sellerProfileId: result.sellerProfileId }
          : {}),
      },
    });

    let inAppNotificationSent = false;

    if (action === "NEEDS_INFO") {
      try {
        await db.notification.create({
          data: {
            userId: result.userId,
            type: "SYSTEM",
            title: "Additional information required",
            link: "/account/seller-application",
            message: result.reason || "Please provide additional information for your seller application.",
          },
        });

        inAppNotificationSent = true;
      } catch (notificationError) {
        console.error(
          "Seller application in-app notification failed:",
          notificationError
        );
      }
    }

    let emailSent = false;

    try {
      const emailResult = await sendSellerApplicationEmail({
        to: result.email,
        businessName: result.businessName,
        status:
          action === "APPROVE"
            ? "APPROVED"
            : action === "REJECT"
              ? "REJECTED"
              : "MORE_INFORMATION_REQUIRED",
        reason: result.reason,
      });

      emailSent = emailResult?.success === true;

      if (!emailSent) {
        console.error(
          "Seller application review email was not delivered:",
          emailResult
        );
      }
    } catch (emailError) {
      console.error(
        "Seller application review email failed:",
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      message: "Application review completed",
      emailSent,
      inAppNotificationSent,
    });
  } catch (error) {
    if (error instanceof ApplicationReviewError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "The application was modified concurrently. Please refresh and try again." },
        { status: 409 }
      );
    }

    console.error("Application review error:", error);

    return NextResponse.json(
      { error: "Failed to process application" },
      { status: 500 }
    );
  }
}
