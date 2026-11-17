 import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type ConversationMetadata = {
  productIds: string[];
  discoveredProductIds: string[];
  selectedProductIds: string[];
};

const extractIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0
          )
        ),
      ].slice(0, 8)
    : [];

const getMetadata = (value: unknown): ConversationMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      productIds: [],
      discoveredProductIds: [],
      selectedProductIds: [],
    };
  }

  const metadata = value as Record<string, unknown>;

  return {
    productIds: extractIds(metadata.productIds),
    discoveredProductIds: extractIds(metadata.discoveredProductIds),
    selectedProductIds: extractIds(metadata.selectedProductIds),
  };
};

// Save an initial discovery/search exchange.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const sessionId =
      typeof body.sessionId === "string"
        ? body.sessionId.trim()
        : "";

    const userMessage =
      typeof body.userMessage === "string"
        ? body.userMessage.trim()
        : "";

    const assistantMessage =
      typeof body.assistantMessage === "string"
        ? body.assistantMessage.trim()
        : "";

    if (
      !sessionId ||
      sessionId.length > 100 ||
      !userMessage ||
      userMessage.length > 1000 ||
      !assistantMessage ||
      assistantMessage.length > 3000
    ) {
      return NextResponse.json(
        { error: "Invalid conversation data." },
        { status: 400 }
      );
    }

    const discoveredProductIds = extractIds(
      body.discoveredProductIds
    );

    const selectedProductIds = extractIds(
      body.selectedProductIds
    );

    const productIds = [
      ...new Set([
        ...discoveredProductIds,
        ...selectedProductIds,
      ]),
    ].slice(0, 8);

    const metadata = {
      productIds,
      discoveredProductIds,
      selectedProductIds,
    };

    await db.aIConversation.createMany({
      data: [
        {
          userId: session.user.id,
          sessionId,
          role: "user",
          content: userMessage,
          metadata,
        },
        {
          userId: session.user.id,
          sessionId,
          role: "assistant",
          content: assistantMessage,
          metadata,
        },
      ],
    });

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error("Save comparison history error:", error);

    return NextResponse.json(
      { error: "Unable to save this conversation." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    // Retrieve one saved conversation.
    if (sessionId) {
      const records = await db.aIConversation.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          content: true,
          createdAt: true,
          metadata: true,
        },
      });

      const messages = records
        .filter(
          (record) =>
            (record.role === "user" ||
              record.role === "assistant") &&
            typeof record.content === "string"
        )
        .map((record) => ({
          role: record.role as "user" | "assistant",
          content: record.content,
          createdAt: record.createdAt.toISOString(),
        }));

      const productIds = new Set<string>();
      const discoveredProductIds = new Set<string>();

      // The latest metadata containing selectedProductIds wins.
      let selectedProductIds: string[] = [];

      for (const record of records) {
        const metadata = getMetadata(record.metadata);

        metadata.productIds.forEach((id) => productIds.add(id));

        metadata.discoveredProductIds.forEach((id) =>
          discoveredProductIds.add(id)
        );

        selectedProductIds = metadata.selectedProductIds;
      }

      return NextResponse.json({
        sessionId,
        messages,
        productIds: [...productIds],
        discoveredProductIds: [...discoveredProductIds],
        selectedProductIds,
      });
    }

    // Retrieve the latest five conversations.
    const records = await db.aIConversation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        sessionId: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    const conversations = new Map<
      string,
      {
        sessionId: string;
        title: string;
        updatedAt: string;
      }
    >();

    for (const record of records) {
      if (!conversations.has(record.sessionId)) {
        conversations.set(record.sessionId, {
          sessionId: record.sessionId,
          title: "Shopping conversation",
          updatedAt: record.createdAt.toISOString(),
        });
      }

      const conversation = conversations.get(record.sessionId)!;

      // Preserve the first user message as the conversation title.
      if (
        record.role === "user" &&
        typeof record.content === "string" &&
        conversation.title === "Shopping conversation"
      ) {
        conversation.title = record.content.slice(0, 80);
      }
    }

    return NextResponse.json({
      conversations: [...conversations.values()].slice(0, 5),
    });
  } catch (error) {
    console.error("Comparison history error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve conversation history." },
      { status: 500 }
    );
  }
}