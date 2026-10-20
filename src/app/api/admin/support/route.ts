// src/app/api/admin/support/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const ReplyTicketSchema = z.object({
  ticketId: z.string().cuid(),
  resolution: z.string().min(5).max(2000),
  status: z.enum(["IN_PROGRESS", "RESOLVED", "CLOSED"]).default("RESOLVED"),
  assignedTo: z.string().optional(),
});

export async function GET() {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const tickets = await db.supportTicket.findMany({
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error("🚨 Admin support GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user: adminUser, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = ReplyTicketSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    const { ticketId, resolution, status, assignedTo } = validation.data;

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { email: true, firstName: true } } },
    });

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const updatedTicket = await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        resolution,
        status,
        assignedTo: assignedTo || adminUser.id,
      },
    });

    // Send email notification to the user
    if (ticket.user?.email) {
      const fullName = [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || "there";
      const html = `
        <div style="font-family: sans-serif; padding: 20px; background: #f4f4f5;">
          <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #111827; margin-top: 0;">Update on your support ticket</h2>
            <p style="color: #4b5563; line-height: 1.6;">Hi ${fullName},</p>
            <p style="color: #4b5563; line-height: 1.6;">The iBUY support team has replied to your ticket: <strong>"${ticket.subject}"</strong></p>
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border-left: 4px solid #4f46e5; margin: 16px 0;">
              <p style="margin: 0; color: #111827; line-height: 1.5;">${resolution}</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">Status: <strong>${status.replace("_", " ")}</strong></p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/seller/support" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #111827; color: white; text-decoration: none; border-radius: 6px;">View Ticket</a>
          </div>
        </div>
      `;
      sendEmail({
        to: ticket.user.email,
        subject: `🎟️ iBUY Support: ${ticket.subject}`,
        html,
      }).catch(err => console.error("Support reply email failed:", err));
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error("🚨 Admin support PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}