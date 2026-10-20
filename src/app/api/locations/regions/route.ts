// src/app/api/locations/regions/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 👇 SAFEST QUERY: No filters. Just get everything in the Region table.
    const regions = await db.region.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true, // Let's see if this field exists and what it says
      },
      orderBy: { name: "asc" },
    });

    // 👇 DEBUG: This will print exactly what Prisma found in your terminal
    console.log("🔍 REGIONS FOUND IN DATABASE:", regions.length, regions);

    return NextResponse.json({ regions });
  } catch (error) {
    // 👇 If Prisma crashes, this will tell us exactly why
    console.error("🚨 PRISMA DATABASE ERROR:", error);
    return NextResponse.json({ error: "Database error fetching regions" }, { status: 500 });
  }
}