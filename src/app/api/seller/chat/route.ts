 // src/app/api/seller/chat/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Find seller profile
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (!sellerProfile) return NextResponse.json({ error: "Not a seller" }, { status: 403 });

    // Fetch all conversations where this user is the seller
    const conversations = await db.conversation.findMany({
      where: {
        sellerId: session.user.id 
      },
      include: {
        buyer: { select: { firstName: true, lastName: true, avatarUrl: true } },
        product: { select: { title: true, images: { take: 1 } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Only get the LAST message for the preview list
        }
      },
      orderBy: {
        updatedAt: 'desc' // Sort by most recently updated
      }
    });

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error("Fetch seller chats error:", error);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}