// src/app/api/admin/disputes/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { status, resolution, refundAmount } = await req.json();

    const validStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED_CUSTOMER", "RESOLVED_SELLER", "CLOSED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const dispute = await db.dispute.update({
      where: { id },
      data: {
        status,
        resolution: resolution || null,
        refundAmount: refundAmount ? parseFloat(refundAmount) : null,
        resolvedBy: session.user.id,
        resolvedAt: new Date(),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DISPUTE_RESOLVED",
        resourceType: "Dispute",
        resourceId: id,
        metadata: { status, resolution, refundAmount },
      },
    });

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Dispute resolution error:", error);
    return NextResponse.json({ error: "Failed to resolve dispute" }, { status: 500 });
  }
}