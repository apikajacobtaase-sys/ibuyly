// src/app/api/admin/notifications/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const SendNotificationSchema = z
  .object({
    userId: z.string().cuid("Invalid user ID").optional(),
    sellerId: z.string().cuid("Invalid seller ID").optional(),
    title: z.string().trim().min(3).max(100),
    message: z.string().trim().min(10).max(1000),
    link: z.string().trim().max(500).optional(),
    sendEmail: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.userId || data.sellerId), {
    message: "Specify either a userId or a sellerId",
    path: ["userId"],
  });

function escapeHtml(value: string): string {
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

function validateRelativeLink(link?: string): string {
  const fallback = "/account/notifications";

  if (!link) return fallback;

  // Only allow local absolute paths. Reject protocol-relative URLs,
  // backslashes, control characters, and URL schemes.
  if (
    !link.startsWith("/") ||
    link.startsWith("//") ||
    link.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(link)
  ) {
    throw new Error("The notification link must be a safe relative path");
  }

  try {
    const parsed = new URL(link, "https://ibuy.invalid");

    if (parsed.origin !== "https://ibuy.invalid") {
      throw new Error("Invalid link origin");
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    throw new Error("Invalid notification link");
  }
}

export async function POST(req: Request) {
  try {
    const { user: adminUser, error } = await requireAdmin();

    if (error) return error;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 }
      );
    }

    const validation = SendNotificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      userId,
      sellerId,
      title,
      message,
      sendEmail: shouldSendEmail,
    } = validation.data;

    let link: string;

    try {
      link = validateRelativeLink(validation.data.link);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid notification link",
        },
        { status: 400 }
      );
    }

    // Resolve the recipient and, when supplied, verify that the seller
    // belongs to that same user.
    let targetUserId = userId;
    let targetSellerId: string | undefined;

    if (sellerId) {
      const seller = await db.sellerProfile.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!seller) {
        return NextResponse.json(
          { error: "Seller not found" },
          { status: 404 }
        );
      }

      if (userId && userId !== seller.userId) {
        return NextResponse.json(
          {
            error:
              "The specified user does not belong to the specified seller",
          },
          { status: 400 }
        );
      }

      targetUserId = seller.userId;
      targetSellerId = seller.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "A notification recipient is required" },
        { status: 400 }
      );
    }

    const recipient = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        isActive: true,
      },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    if (!recipient.isActive) {
      return NextResponse.json(
        { error: "Cannot notify an inactive account" },
        { status: 400 }
      );
    }

    // Persist the notification and audit event together. If either
    // database operation fails, neither is committed.
    const notification = await db.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          userId: recipient.id,
          ...(targetSellerId ? { sellerId: targetSellerId } : {}),
          type: "SYSTEM",
          title,
          message,
          link,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: "ADMIN_SEND_NOTIFICATION",
          resourceType: "NOTIFICATION",
          resourceId: created.id,
          metadata: {
            recipientUserId: recipient.id,
            recipientSellerId: targetSellerId ?? null,
            emailRequested: shouldSendEmail,
          },
        },
      });

      return created;
    });

    // Email delivery is separate from the database transaction.
    // A failed email must not erase the in-app notification.
    let emailStatus:
      | "NOT_REQUESTED"
      | "SENT"
      | "FAILED"
      | "SKIPPED_NO_EMAIL" = "NOT_REQUESTED";

    if (shouldSendEmail) {
      if (!recipient.email) {
        emailStatus = "SKIPPED_NO_EMAIL";
      } else {
        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        ).replace(/\/+$/, "");

        const safeTitle = escapeHtml(title);
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
        const safeFirstName = escapeHtml(recipient.firstName || "there");
        const safeLink = escapeHtml(link);

        const html = `
          <div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f5;">
            <div style="background:#ffffff;padding:24px;border-radius:8px;max-width:500px;margin:0 auto;">
              <h2 style="color:#111827;margin-top:0;">${safeTitle}</h2>
              <p style="color:#4b5563;line-height:1.6;">Hi ${safeFirstName},</p>
              <p style="color:#4b5563;line-height:1.6;">${safeMessage}</p>
              <a href="${appUrl}${safeLink}"
                 style="display:inline-block;margin-top:16px;padding:10px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">
                View in iBUY
              </a>
            </div>
          </div>
        `;

        try {
          const emailResult = await sendEmail({
            to: recipient.email,
            subject: `iBUY Notification: ${title}`,
            html,
          });

          emailStatus = emailResult.success ? "SENT" : "FAILED";

          if (!emailResult.success) {
            console.error(
              "Admin notification email failed",
              emailResult.error
            );
          }
        } catch (emailError) {
          emailStatus = "FAILED";
          console.error(
            "Unexpected admin notification email error:",
            emailError
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          emailStatus === "FAILED"
            ? "In-app notification created, but email delivery failed"
            : emailStatus === "SKIPPED_NO_EMAIL"
              ? "In-app notification created; recipient has no email address"
              : "Notification created successfully",
        notificationId: notification.id,
        emailStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin send notification error:", error);

    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
