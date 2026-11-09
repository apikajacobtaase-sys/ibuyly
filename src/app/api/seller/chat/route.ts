// src/app/api/seller/chat/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
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
        userId: true,
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

    const conversations = await db.conversation.findMany({
      where: {
        sellerId: userId,
      },
      include: {
        buyer: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        product: {
          select: {
            title: true,
            images: { take: 1 },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Fetch seller chats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}