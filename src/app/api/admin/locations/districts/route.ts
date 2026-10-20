 import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get("regionId");

    if (!regionId) {
      return NextResponse.json({ error: "Region ID is required" }, { status: 400 });
    }

    const districts = await db.district.findMany({
      where: { 
        regionId: regionId,
        isActive: true 
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(districts);
  } catch (error) {
    console.error("Failed to fetch districts:", error);
    return NextResponse.json({ error: "Failed to fetch districts" }, { status: 500 });
  }
}