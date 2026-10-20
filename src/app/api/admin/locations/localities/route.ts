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
    const districtId = searchParams.get("districtId");

    if (!districtId) {
      return NextResponse.json({ error: "District ID is required" }, { status: 400 });
    }

    const localities = await db.locality.findMany({
      where: { 
        districtId: districtId,
        isActive: true 
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(localities);
  } catch (error) {
    console.error("Failed to fetch localities:", error);
    return NextResponse.json({ error: "Failed to fetch localities" }, { status: 500 });
  }
}