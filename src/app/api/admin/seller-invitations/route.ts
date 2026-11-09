import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

const InvitationSchema = z.object({
  email: z.string().trim().email().max(254),
});

function getAppUrl() {
  const configuredUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "");

  if (!configuredUrl) {
    throw new Error("Application URL is not configured.");
  }

  const parsed = new URL(configuredUrl);

  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error("Production application URL must use HTTPS.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname)
  ) {
    throw new Error("Production application URL cannot point to localhost.");
  }

  return parsed.origin;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();

    if (error) return error;

    const body = await req.json();
    const validation = InvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const email = validation.data.email.toLowerCase();
    const appUrl = getAppUrl();

    const existingUser = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        sellerProfile: {
          select: { id: true },
        },
      },
    });

    if (existingUser?.sellerProfile) {
      return NextResponse.json(
        { error: "This user already has a seller profile." },
        { status: 409 }
      );
    }

    const rawToken = randomBytes(32).toString("base64url");

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = await db.$transaction(async (tx) => {
      await tx.sellerInvitation.updateMany({
        where: {
          email,
          redeemedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return tx.sellerInvitation.create({
        data: {
          email,
          tokenHash,
          invitedBy: user.id,
          expiresAt,
        },
      });
    });

    const invitationUrl =
      `${appUrl}/seller-application?token=${encodeURIComponent(rawToken)}`;

    let inAppNotificationSent = false;

    if (existingUser) {
      try {
        await db.notification.create({
          data: {
            userId: existingUser.id,
            type: "SYSTEM",
            title: "You're invited to become an iBUY seller!",
            message:
              "An administrator has invited you to apply for a seller account on iBUY. Open this notification to begin your application.",
            link: `/seller-application?invitationId=${encodeURIComponent(invitation.id)}`,
          },
        });

        inAppNotificationSent = true;
      } catch (notificationError) {
        console.error(
          "Seller invitation notification failed:",
          notificationError
        );
      }
    }

    await logAudit({
      userId: user.id,
      action: "SELLER_INVITATION_CREATED",
      resourceType: "SellerInvitation",
      resourceId: invitation.id,
      metadata: {
        email,
        expiresAt: expiresAt.toISOString(),
      },
    });

    let emailSent = false;

    try {
      const safeEmail = escapeHtml(email);

      const emailResult = await sendEmail({
        to: email,
        subject: "You're Invited to Become an iBUY Seller",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111827;">
            <h2 style="color:#0f766e;">You're invited to sell on iBUY!</h2>

            <p>Hello,</p>

            <p>
              You have been invited to apply for a seller account on iBUY,
              Ghana's online marketplace.
            </p>

            <p>
              This invitation is intended for:
              <strong>${safeEmail}</strong>
            </p>

            <p>
              Sign in to your existing iBUY account or create an account
              using the invited email address.
            </p>

            <p style="margin:28px 0;">
              <a
                href="${invitationUrl}"
                style="background:#0f766e;color:white;padding:13px 22px;text-decoration:none;border-radius:8px;font-weight:bold;"
              >
                Continue Seller Application
              </a>
            </p>

            <p>This invitation expires in 48 hours and can only be used once.</p>
            <p>If you were not expecting this invitation, you can ignore this email.</p>
            <p>The iBUY Team</p>
          </div>
        `,
      });

      emailSent = emailResult.success;
    } catch (emailError) {
      console.error("Seller invitation email delivery failed:", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        emailSent,
        inAppNotificationSent,
        message: emailSent
          ? "Seller invitation created and email sent successfully."
          : "Seller invitation created, but email delivery failed. You can share the invitation link manually.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          invitationUrl,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("Seller invitation error:", error);

    return NextResponse.json(
      { error: "Failed to create seller invitation." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  }
}
