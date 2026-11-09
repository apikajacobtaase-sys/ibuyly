// src/app/api/seller/apply/route.ts

import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const ApplicationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  invitationId: z.string().min(1).optional(),
  businessName: z.string().trim().min(2).max(120),
  businessType: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
}).refine(
  (data) => Boolean(data.token) !== Boolean(data.invitationId),
  { message: "Provide exactly one invitation credential." }
);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in before applying." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = ApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Please provide valid application details and invitation credentials.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      token,
      invitationId,
      businessName,
      businessType,
      description,
    } = validation.data;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        isActive: true,
        sellerProfile: {
          select: { id: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Your account is unavailable." },
        { status: 403 }
      );
    }

    if (user.sellerProfile) {
      return NextResponse.json(
        { error: "You already have a seller account." },
        { status: 409 }
      );
    }

    const email = user.email.toLowerCase().trim();

    const invitation = token
      ? await db.sellerInvitation.findUnique({
          where: {
            tokenHash: createHash("sha256").update(token).digest("hex"),
          },
        })
      : await db.sellerInvitation.findUnique({
          where: { id: invitationId! },
        });

    if (
      !invitation ||
      invitation.email.toLowerCase().trim() !== email ||
      invitation.redeemedAt ||
      invitation.revokedAt ||
      invitation.applicationId ||
      invitation.expiresAt <= new Date()
    ) {
      return NextResponse.json(
        {
          error: "This invitation is invalid, expired, revoked, already used, or belongs to another email address.",
        },
        { status: 400 }
      );
    }

    const application = await db.$transaction(
      async (tx) => {
        const existingApplication = await tx.sellerApplication.findFirst({
          where: {
            userId: user.id,
            status: {
              in: ["PENDING", "UNDER_REVIEW", "NEEDS_INFO"],
            },
          },
          select: { id: true },
        });

        if (existingApplication) {
          throw new Error("APPLICATION_ALREADY_PENDING");
        }

        const redeemed = await tx.sellerInvitation.updateMany({
          where: {
            id: invitation.id,
            email,
            redeemedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            applicationId: null,
          },
          data: {
            redeemedAt: new Date(),
          },
        });

        if (redeemed.count !== 1) {
          throw new Error("INVITATION_UNAVAILABLE");
        }

        const createdApplication = await tx.sellerApplication.create({
          data: {
            userId: user.id,
            businessName,
            businessType,
            description,
            status: "PENDING",
          },
        });

        await tx.sellerInvitation.update({
          where: { id: invitation.id },
          data: {
            applicationId: createdApplication.id,
          },
        });

        return createdApplication;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    await logAudit({
      userId: user.id,
      action: "SELLER_APPLICATION_SUBMITTED",
      resourceType: "SellerApplication",
      resourceId: application.id,
      metadata: {
        businessName,
        invitationId: invitation.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your seller application has been submitted successfully.",
        applicationId: application.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "APPLICATION_ALREADY_PENDING"
    ) {
      return NextResponse.json(
        { error: "You already have an application awaiting review." },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVITATION_UNAVAILABLE"
    ) {
      return NextResponse.json(
        { error: "This invitation has already been used or is no longer available." },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Your application conflicted with another request. Please try again." },
        { status: 409 }
      );
    }

    console.error("Seller application error:", error);

    return NextResponse.json(
      { error: "Failed to submit your application. Please try again." },
      { status: 500 }
    );
  }
}
