 // src/app/api/admin/audit-logs/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { user, error } = await requireAdmin();

    if (error) return error;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";
    const resourceType = searchParams.get("resourceType") || "";
    const userId = searchParams.get("userId") || "";

    const where = {
      ...(action ? { action } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(userId ? { userId } : {}),
    };

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const actorIds = [
      ...new Set(
        logs
          .map((log) => log.userId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })
      : [];

    const actorsById = new Map(
      actors.map((actor) => [actor.id, actor])
    );

    return NextResponse.json({
      logs: logs.map((log) => {
        const actor = log.userId
          ? actorsById.get(log.userId)
          : undefined;

        const fullName = actor
          ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim()
          : "";

        return {
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          metadata: log.metadata,
          userName: fullName || actor?.email || "System",
          userEmail: actor?.email ?? null,
          createdAt: log.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Admin audit logs error:", error);

    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}