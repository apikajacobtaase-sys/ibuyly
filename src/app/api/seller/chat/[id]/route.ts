 // src/app/api/seller/chat/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const conversationId = resolvedParams.id;

    // Verify the seller owns this conversation
    const conv = await db.conversation.findUnique({
      where: { id: conversationId, sellerId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }, // Oldest first for chat view
          include: {
            sender: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({ messages: conv.messages });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}