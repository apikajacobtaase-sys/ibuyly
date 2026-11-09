// src/app/api/pusher/auth/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        accountStatus: true,
      },
    });

    if (!user || !user.isActive || user.accountStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    const formData = new URLSearchParams(await req.text());
    const socketId = formData.get("socket_id");
    const channelName = formData.get("channel_name");

    if (
      !socketId ||
      !/^\d+\.\d+$/.test(socketId) ||
      !channelName ||
      !channelName.startsWith("private-chat-")
    ) {
      return NextResponse.json({ error: "Invalid channel request" }, { status: 400 });
    }

    const conversationId = channelName.slice("private-chat-".length);

    if (!conversationId || conversationId.length > 191) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const authorization = pusherServer.authorizeChannel(
      socketId,
      channelName
    );

    return NextResponse.json(authorization);
  } catch (error) {
    console.error("Pusher channel authorization error:", error);
    return NextResponse.json(
      { error: "Channel authorization failed" },
      { status: 500 }
    );
  }
}