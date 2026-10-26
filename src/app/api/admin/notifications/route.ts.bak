// src/app/api/admin/notifications/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const SendNotificationSchema = z.object({
  userId: z.string().cuid("Invalid user ID").optional(),
  sellerId: z.string().cuid("Invalid seller ID").optional(),
  title: z.string().min(3).max(100),
  message: z.string().min(10).max(1000),
  link: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const { user: adminUser, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = SendNotificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, sellerId, title, message, link, sendEmail } = validation.data;

    if (!userId && !sellerId) {
      return NextResponse.json(
        { error: "You must specify either a userId or a sellerId" },
        { status: 400 }
      );
    }

    let targetUserId = userId;
    let targetSellerId = sellerId;

    // If only sellerId is provided, find the associated userId
    if (sellerId && !userId) {
      const seller = await db.sellerProfile.findUnique({
        where: { id: sellerId },
        select: { userId: true, businessName: true },
      });
      if (!seller) {
        return NextResponse.json({ error: "Seller not found" }, { status: 404 });
      }
      targetUserId = seller.userId;
    }

    // Create the in-app notification
    const notification = await db.notification.create({
      data: {
        userId: targetUserId,
        sellerId: targetSellerId || undefined,
        type: "SYSTEM",
        title,
        message,
        link: link || "/account/notifications",
      },
    });

    // Optionally send an email
    if (sendEmail && targetUserId) {
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: { email: true, firstName: true },
      });

      if (user?.email) {
        const html = `
          <div style="font-family: sans-serif; padding: 20px; background: #f4f4f5;">
            <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #111827; margin-top: 0;">${title}</h2>
              <p style="color: #4b5563; line-height: 1.6;">Hi ${user.firstName || "there"},</p>
              <p style="color: #4b5563; line-height: 1.6;">${message}</p>
              ${link ? `<a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${link}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #111827; color: white; text-decoration: none; border-radius: 6px;">View in Dashboard</a>` : ""}
            </div>
          </div>
        `;

        sendEmail({
          to: user.email,
          subject: `🔔 iBUY Notification: ${title}`,
          html,
        }).catch((err) => console.error("Admin notification email failed:", err));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Notification sent successfully",
      notificationId: notification.id,
    });
  } catch (error: any) {
    console.error("🚨 Admin send notification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
