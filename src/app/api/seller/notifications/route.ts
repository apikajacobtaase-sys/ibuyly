// src/app/api/seller/notifications/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

async function getActiveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (typeof userId !== "string" || !userId.trim()) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      accountStatus: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.accountStatus !== "ACTIVE"
  ) {
    return null;
  }

  return user.id;
}

export async function GET() {
  try {
    const userId = await getActiveUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized or inactive account." },
        { status: 401 }
      );
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      }),
      db.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);

    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getActiveUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized or inactive account." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const keys = Object.keys(payload);

    if (
      keys.length !== 1 ||
      (keys[0] !== "markAllRead" && keys[0] !== "notificationId")
    ) {
      return NextResponse.json(
        { error: "Provide either markAllRead or notificationId." },
        { status: 400 }
      );
    }

    if (payload.markAllRead === true) {
      await db.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (
      typeof payload.notificationId !== "string" ||
      !payload.notificationId.trim() ||
      payload.notificationId.length > 191
    ) {
      return NextResponse.json(
        { error: "A valid notification ID is required." },
        { status: 400 }
      );
    }

    const result = await db.notification.updateMany({
      where: {
        id: payload.notificationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      const existing = await db.notification.findFirst({
        where: {
          id: payload.notificationId,
          userId,
        },
        select: { id: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Notification not found." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update notification error:", error);

    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}