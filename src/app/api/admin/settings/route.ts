 import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "platform" },
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
        expectedBackAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      settings: settings ?? {
        maintenanceMode: false,
        maintenanceMessage: null,
        expectedBackAt: null,
        updatedAt: null,
      },
      canManageMaintenance: auth.user.role === "SUPER_ADMIN",
    });
  } catch (error) {
    console.error("Fetch platform settings error:", error);
    return NextResponse.json(
      { error: "Unable to fetch platform settings. Ensure the migration has been applied." },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  if (auth.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only Super Admin can change platform settings." },
      { status: 403 }
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (typeof input.maintenanceMode !== "boolean") {
      return NextResponse.json({ error: "maintenanceMode must be a boolean." }, { status: 400 });
    }

    if (input.maintenanceMessage !== undefined && input.maintenanceMessage !== null && (typeof input.maintenanceMessage !== "string" || input.maintenanceMessage.length > 500)) {
      return NextResponse.json({ error: "Maintenance message must be 500 characters or fewer." }, { status: 400 });
    }

    let expectedBackAt: Date | null = null;

    if (input.expectedBackAt !== undefined && input.expectedBackAt !== null && input.expectedBackAt !== "") {
      if (typeof input.expectedBackAt !== "string" || !Number.isFinite(Date.parse(input.expectedBackAt))) {
        return NextResponse.json({ error: "Invalid expected return time." }, { status: 400 });
      }

      expectedBackAt = new Date(input.expectedBackAt);

      if (expectedBackAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Expected return time must be in the future." }, { status: 400 });
      }
    }

    const maintenanceMessage = typeof input.maintenanceMessage === "string" ? input.maintenanceMessage.trim() || null : null;

    const result = await db.$transaction(async (tx) => {
      const previous = await tx.platformSettings.findUnique({
        where: { id: "platform" },
      });

      const updated = await tx.platformSettings.upsert({
        where: { id: "platform" },
        create: {
          id: "platform",
          maintenanceMode: input.maintenanceMode as boolean,
          maintenanceMessage,
          expectedBackAt,
          updatedById: auth.user.id,
        },
        update: {
          maintenanceMode: input.maintenanceMode as boolean,
          maintenanceMessage,
          expectedBackAt,
          updatedById: auth.user.id,
        },
        select: {
          maintenanceMode: true,
          maintenanceMessage: true,
          expectedBackAt: true,
          updatedAt: true,
        },
      });

      const modeChanged = (previous?.maintenanceMode ?? false) !== updated.maintenanceMode;

      const action = modeChanged
        ? updated.maintenanceMode
          ? "PLATFORM_MAINTENANCE_ENABLED"
          : "PLATFORM_MAINTENANCE_DISABLED"
        : "PLATFORM_MAINTENANCE_SETTINGS_UPDATED";

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action,
          resourceType: "PlatformSettings",
          resourceId: "platform",
          metadata: {
            previousMaintenanceMode: previous?.maintenanceMode ?? false,
            maintenanceMode: updated.maintenanceMode,
            maintenanceMessage: updated.maintenanceMessage,
            expectedBackAt: updated.expectedBackAt?.toISOString() ?? null,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    console.error("Update platform settings error:", error);
    return NextResponse.json(
      { error: "Unable to update platform settings. Ensure the migration has been applied." },
      { status: 503 }
    );
  }
}