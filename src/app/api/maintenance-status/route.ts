 import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "platform" },
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
        expectedBackAt: true,
      },
    });

    return NextResponse.json(
      {
        maintenanceMode: settings?.maintenanceMode ?? false,
        message: settings?.maintenanceMessage ?? null,
        expectedBackAt: settings?.expectedBackAt ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Maintenance status check failed:", error);

    // Fail open if the database is temporarily unavailable.
    return NextResponse.json(
      { maintenanceMode: false, unavailable: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}