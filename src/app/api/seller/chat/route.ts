 // src/app/api/seller/chat/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Find the Seller Profile to get the associated User ID
    const sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, userId: true } // Ensure we have both IDs
    });

    if (!sellerProfile) {
      console.log("User is not a seller:", session.user.id);
      return NextResponse.json({ error: "Not a seller" }, { status: 403 });
    }

    console.log("Fetching chats for Seller User ID:", sellerProfile.userId);

    // 2. Fetch conversations where the sellerId matches the User ID
    // Note: In your schema, Conversation.sellerId likely links to User.id
    const conversations = await db.conversation.findMany({
      where: {
        sellerId: sellerProfile.userId 
      },
      include: {
        buyer: { select: { firstName: true, lastName: true, avatarUrl: true } },
        product: { select: { title: true, images: { take: 1 } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Found ${conversations.length} conversations.`);
    return NextResponse.json({ conversations });

  } catch (error) {
    console.error("Fetch seller chats error:", error);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}