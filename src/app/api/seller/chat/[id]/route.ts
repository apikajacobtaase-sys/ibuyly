// src/app/api/seller/chat/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 }
      );
    }

    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId },
      select: {
        isActive: true,
        verificationStatus: true,
      },
    });

    if (
      !sellerProfile ||
      !sellerProfile.isActive ||
      sellerProfile.verificationStatus !== "VERIFIED"
    ) {
      return NextResponse.json(
        { error: "Active verified seller account required" },
        { status: 403 }
      );
    }

    const { id: conversationId } = await params;

    if (!conversationId || conversationId.length > 191) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 }
      );
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        sellerId: userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ messages: conversation.messages });
  } catch (error) {
    console.error("Fetch seller conversation messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}