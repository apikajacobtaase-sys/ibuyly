// src/app/api/chat/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, accountStatus: true },
    });

    if (!user || !user.isActive || user.accountStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const content =
      typeof data.content === "string" ? data.content.trim() : "";

    if (!content || content.length > 2000) {
      return NextResponse.json(
        { error: "Message must contain between 1 and 2000 characters" },
        { status: 400 }
      );
    }

    let conversation;

    if (typeof data.conversationId === "string" && data.conversationId.trim()) {
      if (data.receiverId !== undefined || data.productId !== undefined) {
        return NextResponse.json(
          { error: "Invalid conversation request" },
          { status: 400 }
        );
      }

      conversation = await db.conversation.findFirst({
        where: {
          id: data.conversationId.trim(),
          OR: [{ buyerId: userId }, { sellerId: userId }],
        },
        select: { id: true },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
    } else {
      const receiverId =
        typeof data.receiverId === "string" ? data.receiverId.trim() : "";
      const productId =
        typeof data.productId === "string" ? data.productId.trim() : "";

      if (
        !receiverId ||
        !productId ||
        receiverId.length > 191 ||
        productId.length > 191 ||
        receiverId === userId
      ) {
        return NextResponse.json(
          { error: "A valid seller and product are required" },
          { status: 400 }
        );
      }

      const seller = await db.sellerProfile.findFirst({
        where: {
          userId: receiverId,
          isActive: true,
          verificationStatus: "VERIFIED",
          user: {
            isActive: true,
            accountStatus: "ACTIVE",
          },
        },
        select: { id: true, userId: true },
      });

      if (!seller) {
        return NextResponse.json(
          { error: "Seller is unavailable" },
          { status: 404 }
        );
      }

      const activeOffer = await db.sellerOffer.findFirst({
        where: {
          sellerId: seller.id,
          status: "ACTIVE",
          variant: {
            is: {
              productId,
              isActive: true,
              product: {
                is: { status: "ACTIVE" },
              },
            },
          },
        },
        select: { id: true },
      });

      if (!activeOffer) {
        return NextResponse.json(
          { error: "This seller does not have an active offer for this product" },
          { status: 404 }
        );
      }

      conversation = await db.conversation.findFirst({
        where: {
          buyerId: userId,
          sellerId: seller.userId,
          productId,
        },
        select: { id: true },
      });

      if (!conversation) {
        conversation = await db.conversation.create({
          data: {
            buyerId: userId,
            sellerId: seller.userId,
            productId,
          },
          select: { id: true },
        });
      }
    }

    const message = await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content,
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    try {
      await pusherServer.trigger(
        `private-chat-${conversation.id}`,
        "new-message",
        message
      );
    } catch (pusherError) {
      console.error("Chat message saved, but Pusher delivery failed:", pusherError);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}