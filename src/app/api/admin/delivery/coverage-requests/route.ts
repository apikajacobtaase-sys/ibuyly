// src/app/api/delivery/coverage-requests/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const CoverageRequestSchema = z.object({
  regionId: z.string().cuid(),
  districtId: z.string().cuid(),
  localityId: z.string().cuid().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const validation = CoverageRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { regionId, districtId, localityId } = validation.data;

    // Check if request already exists for this location
    const existing = await db.deliveryCoverageRequest.findUnique({
      where: {
        regionId_districtId_localityId: {
          regionId,
          districtId,
          localityId: localityId || "",
        },
      },
    });

    if (existing) {
      // Increment request count
      await db.deliveryCoverageRequest.update({
        where: { id: existing.id },
        data: {
          requestCount: { increment: 1 },
          lastRequestedAt: new Date(),
        },
      });
    } else {
      // Create new request
      await db.deliveryCoverageRequest.create({
        data: {
          userId: session?.user?.id || null,
          regionId,
          districtId,
          localityId: localityId || null,
          status: "NEW",
          requestCount: 1,
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Thank you! We've received your request and will consider expanding delivery to this area." 
    });
  } catch (error) {
    console.error("Coverage request error:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}