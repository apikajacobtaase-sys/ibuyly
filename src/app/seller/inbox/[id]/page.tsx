 // src/app/seller/inbox/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatBox from "@/components/chat/ChatBox"; // Reuse the component!

export default function SellerChatPage() {
  const params = useParams();
  const conversationId = params.id as string;
  
  // You might want to fetch initial messages here via an API call
  // For now, we pass an empty array and let Pusher handle the rest
  const [initialMessages, setInitialMessages] = useState([]);

  return (
    <div className="max-w-4xl mx-auto p-6 h-[calc(100vh-100px)]">
      <ChatBox conversationId={conversationId} initialMessages={initialMessages} />
    </div>
  );
}