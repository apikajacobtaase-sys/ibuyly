 // src/app/seller/inbox/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Clock } from "lucide-react";
import Image from "next/image";

interface Conversation {
  id: string;
  buyer: { firstName: string; lastName: string; avatarUrl?: string | null };
  product: { title: string; images: { url: string }[] };
  messages: { content: string; createdAt: string }[];
  createdAt: string;
}

export default function SellerInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seller/chat")
      .then(res => res.json())
      .then(data => {
        setConversations(data.conversations || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading inbox...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-green-600" />
        Seller Inbox
      </h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {conversations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No conversations yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((conv) => (
              <Link 
                href={`/seller/inbox/${conv.id}`} 
                key={conv.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
              >
                {/* Buyer Avatar */}
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {conv.buyer.avatarUrl ? (
                    <Image src={conv.buyer.avatarUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                      {conv.buyer.firstName[0]}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {conv.buyer.firstName} {conv.buyer.lastName}
                    </h3>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-green-600 font-medium truncate mb-1">
                    Re: {conv.product?.title || "General Inquiry"}
                  </p>
                  
                  <p className="text-sm text-gray-500 truncate">
                    {conv.messages[0]?.content || "No messages yet"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}