// src/app/api/admin/locations/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const UpdateLocationStatusSchema = z.object({
  id: z.string(),
  type: z.enum(["REGION", "DISTRICT"]),
  status: z.enum(["ACTIVE", "TEMPORARILY_UNAVAILABLE", "INACTIVE"]),
});

export async function GET() {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    // Fetch all regions with their districts
    const regions = await db.region.findMany({
      include: {
        districts: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ regions });
  } catch (error: any) {
    console.error("🚨 Admin locations GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch locations" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdateLocationStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    const { id, type, status } = validation.data;

    if (type === "REGION") {
      await db.region.update({
        where: { id },
        data: { status },
      });
    } else {
      await db.district.update({
        where: { id },
        data: { status },
      });
    }

    return NextResponse.json({ success: true, message: "Status updated successfully" });
  } catch (error: any) {
    console.error("🚨 Admin locations PATCH error:", error);
    return NextResponse.json({ error: error.message || "Failed to update location status" }, { status: 500 });
  }
}