// src/app/api/locations/localities/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  districtId: z.string().cuid("Invalid district ID"),
  search: z.string().optional(), // For future searchable dropdowns
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const districtId = searchParams.get("districtId");
    const search = searchParams.get("search") || undefined;

    const validation = QuerySchema.safeParse({ districtId, search });
    if (!validation.success) {
      return NextResponse.json({ error: "Valid districtId is required" }, { status: 400 });
    }

    const localities = await db.locality.findMany({
      where: { 
        districtId: validation.data.districtId,
        isActive: true,
        ...(validation.data.search ? { name: { contains: validation.data.search, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
      take: 50, // Prevent overwhelming the client
    });

    return NextResponse.json({ localities });
  } catch (error) {
    console.error("Failed to fetch localities:", error);
    return NextResponse.json({ error: "Failed to fetch localities" }, { status: 500 });
  }
}