// src/app/api/admin/delivery/requests/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const UpdateRequestSchema = z.object({
  status: z.enum(["NEW", "UNDER_REVIEW", "PLANNED", "APPROVED", "REJECTED", "COVERED"]),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await db.deliveryCoverageRequest.findMany({
      include: {
        region: { select: { name: true } },
        district: { select: { name: true } },
        locality: { select: { name: true } },
      },
      orderBy: { lastRequestedAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Fetch requests error:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;
    
    const validation = UpdateRequestSchema.safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const updated = await db.deliveryCoverageRequest.update({
      where: { id },
      data: {
        ...validation.data,
        lastRequestedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    console.error("Update request error:", error);
    return NextResponse.json({ error: error.message || "Failed to update request" }, { status: 500 });
  }
}