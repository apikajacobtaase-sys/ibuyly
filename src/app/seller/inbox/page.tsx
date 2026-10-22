 // src/app/seller/inbox/page.tsx
"use client";

// ✅ Force Dynamic Rendering
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MessageSquare, ArrowLeft } from "lucide-react";
import Image from "next/image";
import ChatBox from "@/components/chat/ChatBox";

interface Conversation {
  id: string;
  buyer: { firstName: string; lastName: string; avatarUrl?: string | null };
  product: { title: string; images: { url: string }[] };
  messages: { content: string; createdAt: string; senderId: string }[];
  updatedAt: string;
}

const formatTime = (dateString: string | undefined) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function SellerInboxPage() {
  // ✅ Safe access to searchParams
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fullMessages, setFullMessages] = useState<any[]>([]);

  // 1. Fetch List of Conversations
  useEffect(() => {
    fetch("/api/seller/chat")
      .then(res => res.json())
      .then(data => {
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch chats", err);
        setLoading(false);
      });
  }, []);

  // 2. Fetch Full History when a conversation is selected
  useEffect(() => {
    if (selectedId) {
      fetch(`/api/seller/chat/${selectedId}`)
        .then(res => res.json())
        .then(data => {
          setFullMessages(data.messages || []);
        });
    } else {
      setFullMessages([]);
    }
  }, [selectedId]);

  const filteredConvs = conversations.filter(c => 
    c.buyer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.product?.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-80px)] flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm m-4 md:m-6">
      
      {/* LEFT: Conversation List */}
      <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${selectedId ? "hidden md:flex" : "flex"}`}>
        
        {/* Header & Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No conversations found.</div>
          ) : (
            filteredConvs.map((conv) => (
              <Link 
                href={`/seller/inbox?id=${conv.id}`} 
                key={conv.id}
                className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 ${selectedId === conv.id ? "bg-green-50 border-l-4 border-l-green-600" : ""}`}
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {conv.buyer.avatarUrl ? (
                    <Image src={conv.buyer.avatarUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg">
                      {conv.buyer.firstName[0]}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{conv.buyer.firstName}</h3>
                    <span className="text-xs text-gray-400">{formatTime(conv.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-green-600 truncate mb-1">{conv.product?.title || "General Inquiry"}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {conv.messages[0]?.content || "Start a conversation"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Chat Window */}
      <div className={`flex-1 flex flex-col bg-gray-50 ${selectedId ? "flex" : "hidden md:flex"}`}>
        {selectedId ? (
          <>
            {/* Mobile Back Button Header */}
            <div className="md:hidden p-3 bg-white border-b border-gray-200 flex items-center gap-3">
              <Link href="/seller/inbox" className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <span className="font-semibold text-gray-900">Chat</span>
            </div>
            
            {/* Pass fullMessages to ChatBox */}
            <div className="flex-1 p-0 md:p-4 h-full">
               <ChatBox conversationId={selectedId} initialMessages={fullMessages} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a customer to start messaging</p>
          </div>
        )}
      </div>

    </div>
  );
}