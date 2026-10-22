 "use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MessageSquare, ArrowLeft } from "lucide-react";
import Image from "next/image";
import ChatBox from "@/components/chat/ChatBox";

interface Conversation {
id: string;
buyer: {
firstName: string;
lastName: string;
avatarUrl?: string | null;
};
product?: {
title: string;
images?: { url: string }[];
} | null;
messages: {
content: string;
createdAt: string;
senderId: string;
}[];
updatedAt: string;
}

interface ChatMessage {
id?: string;
content: string;
createdAt: string;
senderId: string;
}

function formatTime(dateString?: string) {
if (!dateString) return "";

const date = new Date(dateString);

if (Number.isNaN(date.getTime())) return "";

return date.toLocaleTimeString([], {
hour: "2-digit",
minute: "2-digit",
});
}

function SellerInboxContent() {
const searchParams = useSearchParams();
const selectedId = searchParams.get("id");

const [conversations, setConversations] = useState<Conversation[]>([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState("");
const [fullMessages, setFullMessages] = useState<ChatMessage[]>([]);
const [messagesLoading, setMessagesLoading] = useState(false);

useEffect(() => {
let cancelled = false;


async function loadConversations() {
  try {
    const response = await fetch("/api/seller/chat");

    if (!response.ok) {
      throw new Error("Failed to load conversations");
    }

    const data = await response.json();

    if (!cancelled) {
      setConversations(
        Array.isArray(data.conversations) ? data.conversations : []
      );
    }
  } catch (error) {
    console.error("Failed to fetch chats:", error);

    if (!cancelled) {
      setConversations([]);
    }
  } finally {
    if (!cancelled) {
      setLoading(false);
    }
  }
}

loadConversations();

return () => {
  cancelled = true;
};


}, []);

useEffect(() => {
let cancelled = false;


async function loadMessages() {
  if (!selectedId) {
    setFullMessages([]);
    setMessagesLoading(false);
    return;
  }

  setMessagesLoading(true);
  setFullMessages([]);

  try {
    const response = await fetch(
      `/api/seller/chat/${encodeURIComponent(selectedId)}`
    );

    if (!response.ok) {
      throw new Error("Failed to load conversation messages");
    }

    const data = await response.json();

    if (!cancelled) {
      setFullMessages(
        Array.isArray(data.messages) ? data.messages : []
      );
    }
  } catch (error) {
    console.error("Failed to fetch conversation messages:", error);

    if (!cancelled) {
      setFullMessages([]);
    }
  } finally {
    if (!cancelled) {
      setMessagesLoading(false);
    }
  }
}

loadMessages();

return () => {
  cancelled = true;
};


}, [selectedId]);

const normalizedSearch = searchTerm.toLowerCase();

const filteredConversations = conversations.filter((conversation) => {
const buyerName = conversation.buyer?.firstName ?? "";
const productTitle = conversation.product?.title ?? "";


return (
  buyerName.toLowerCase().includes(normalizedSearch) ||
  productTitle.toLowerCase().includes(normalizedSearch)
);


});

return ( <div className="m-4 flex h-[calc(100vh-80px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:m-6">
{/* Conversation list */}
<div
className={`flex w-full flex-col border-r border-gray-200 md:w-96 ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
> <div className="border-b border-gray-100 bg-gray-50 p-4"> <h2 className="mb-4 text-xl font-bold text-gray-900">
Messages </h2>


      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="p-4 text-center text-gray-500">
          Loading conversations...
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No conversations found.
        </div>
      ) : (
        filteredConversations.map((conversation) => {
          const firstName =
            conversation.buyer?.firstName || "Customer";

          const avatarUrl = conversation.buyer?.avatarUrl;

          return (
            <Link
              href={`/seller/inbox?id=${encodeURIComponent(conversation.id)}`}
              key={conversation.id}
              className={`flex items-center gap-3 border-b border-gray-50 p-4 transition-colors hover:bg-gray-50 ${
                selectedId === conversation.id
                  ? "border-l-4 border-l-green-600 bg-green-50"
                  : ""
              }`}
            >
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-500">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="truncate font-semibold text-gray-900">
                    {firstName}
                  </h3>

                  <span className="text-xs text-gray-400">
                    {formatTime(conversation.updatedAt)}
                  </span>
                </div>

                <p className="mb-1 truncate text-xs text-green-600">
                  {conversation.product?.title || "General Inquiry"}
                </p>

                <p className="truncate text-sm text-gray-500">
                  {conversation.messages?.[0]?.content ||
                    "Start a conversation"}
                </p>
              </div>
            </Link>
          );
        })
      )}
    </div>
  </div>

  {/* Chat window */}
  <div
    className={`flex-1 flex-col bg-gray-50 ${
      selectedId ? "flex" : "hidden md:flex"
    }`}
  >
    {selectedId ? (
      <>
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white p-3 md:hidden">
          <Link
            href="/seller/inbox"
            className="rounded-full p-2 hover:bg-gray-100"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>

          <span className="font-semibold text-gray-900">Chat</span>
        </div>

        <div className="h-full flex-1 p-0 md:p-4">
          {messagesLoading ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              Loading messages...
            </div>
          ) : (
            <ChatBox
              conversationId={selectedId}
              initialMessages={fullMessages}
            />
          )}
        </div>
      </>
    ) : (
      <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
        <MessageSquare className="mb-4 h-16 w-16 opacity-20" />
        <p>Select a customer to start messaging</p>
      </div>
    )}
  </div>
</div>


);
}

export default function SellerInboxPage() {
return (
<Suspense
fallback={ <div className="m-4 flex h-[calc(100vh-80px)] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 md:m-6">
Loading inbox... </div>
}
> <SellerInboxContent /> </Suspense>
);
}
