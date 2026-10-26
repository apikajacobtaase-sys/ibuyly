// src/app/api/delivery/coverage-requests/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const CoverageRequestSchema = z.object({
  regionId: z.string().optional(),
  districtId: z.string().optional(),
  localityId: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const validation = CoverageRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    let { regionId, districtId, localityId, email, notes } = validation.data;
    const userId = session?.user?.id || null;
    const userEmail = email || session?.user?.email || null;

    // Smart fallback: If only localityId is provided, resolve the region and district
    if (localityId && (!regionId || !districtId)) {
      const locality = await db.locality.findUnique({
        where: { id: localityId },
        include: { district: { include: { region: true } } },
      });

      if (!locality) {
        return NextResponse.json({ error: "Locality not found" }, { status: 404 });
      }

      regionId = locality.district.regionId;
      districtId = locality.districtId;
    }

    if (!regionId || !districtId) {
      return NextResponse.json({ error: "Missing location data" }, { status: 400 });
    }

    // 🛡️ USE UPSERT to prevent Unique Constraint Violations during race conditions
    let result;

const requestData = {
  requestCount: { increment: 1 },
  lastRequestedAt: new Date(),
  userId: userId || undefined,
  email: userEmail || undefined,
  notes: notes || undefined,
};

if (localityId) {
  // A specific locality has a non-null ID, so use the compound unique key.
  result = await db.deliveryCoverageRequest.upsert({
    where: {
      regionId_districtId_localityId: {
        regionId,
        districtId,
        localityId,
      },
    },
    update: requestData,
    create: {
      regionId,
      districtId,
      localityId,
      userId,
      email: userEmail,
      notes: notes || null,
      status: "NEW",
      requestCount: 1,
      lastRequestedAt: new Date(),
    },
  });
} else {
  // NULL locality IDs cannot be used in Prisma's compound unique selector.
  const existing = await db.deliveryCoverageRequest.findFirst({
    where: {
      regionId,
      districtId,
      localityId: null,
    },
  });

  if (existing) {
    result = await db.deliveryCoverageRequest.update({
      where: { id: existing.id },
      data: requestData,
    });
  } else {
    result = await db.deliveryCoverageRequest.create({
      data: {
        regionId,
        districtId,
        localityId: null,
        userId,
        email: userEmail,
        notes: notes || null,
        status: "NEW",
        requestCount: 1,
        lastRequestedAt: new Date(),
      },
    });
  }
}

    return NextResponse.json({ 
      success: true, 
      message: result.requestCount > 1 
        ? "Request count updated! We're working on it." 
        : "Request received! We'll notify you when we expand here." 
    });
  } catch (error: any) {
    console.error("🚨 Coverage request error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit request" }, { status: 500 });
  }
}