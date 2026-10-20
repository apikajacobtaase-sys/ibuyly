// src/app/api/admin/staff/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staff = await db.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPPORT"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        email: s.email,
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Unnamed",
        role: s.role,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, role } = await req.json();

    if (!["ADMIN", "SUPPORT"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { role },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "STAFF_ROLE_UPDATED",
        resourceType: "User",
        resourceId: userId,
        metadata: { newRole: role },
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Staff update error:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}