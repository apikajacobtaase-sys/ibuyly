// src/app/api/locations/districts/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  regionId: z.string().cuid("Invalid region ID"),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regionId = searchParams.get("regionId");

    const validation = QuerySchema.safeParse({ regionId });
    if (!validation.success) {
      return NextResponse.json({ error: "Valid regionId is required" }, { status: 400 });
    }

    const districts = await db.district.findMany({
      where: { 
        regionId: validation.data.regionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ districts });
  } catch (error) {
    console.error("Failed to fetch districts:", error);
    return NextResponse.json({ error: "Failed to fetch districts" }, { status: 500 });
  }
}