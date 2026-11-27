 import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const regions = await db.region.findMany({
  where: {
    isActive: true,
  },
  select: {
    id: true,
    name: true,
  },
  orderBy: {
    name: "asc",
  },
});

    return NextResponse.json({ regions });
  } catch (error) {
    console.error("Failed to fetch regions:", error);

    return NextResponse.json(
      { error: "Unable to fetch regions." },
      { status: 500 }
    );
  }
}