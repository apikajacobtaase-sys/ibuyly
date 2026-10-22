 // src/app/api/chat/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId, content, receiverId, productId } = await req.json();

    let convId = conversationId;

    // If no conversation exists, create one
    if (!convId) {
      const existingConv = await db.conversation.findFirst({
        where: {
          AND: [
            { buyerId: session.user.id },
            { sellerId: receiverId },
            { productId: productId || null }
          ]
        }
      });

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const newConv = await db.conversation.create({
          data: {
            buyerId: session.user.id,
            sellerId: receiverId,
            productId: productId || null
          }
        });
        convId = newConv.id;
      }
    }

    // Save Message to DB
    const message = await db.message.create({
      data: {
        conversationId: convId,
        senderId: session.user.id,
        content
      },
      include: {
        sender: { select: { firstName: true, lastName: true } }
      }
    });

    // ✅ Trigger Real-Time Event via Pusher
    await pusherServer.trigger(`chat-${convId}`, 'new-message', message);

    return NextResponse.json({ success: true, message });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}