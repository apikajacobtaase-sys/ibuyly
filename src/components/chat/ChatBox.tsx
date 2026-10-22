 // src/components/chat/ChatBox.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import PusherClient from "pusher-js";
import { Send, X } from "lucide-react";
import { useSession } from "next-auth/react";
export const dynamic = 'force-dynamic'; 
// ... interfaces ...

export default function ChatBox({ conversationId, initialMessages }: { conversationId: string, initialMessages: any[] }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null); // ✅ State for reply
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ... Pusher logic ...

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        conversationId, 
        content: input,
        replyToId: replyTo?.id // ✅ Send reply ID
      }),
    });

    setInput("");
    setReplyTo(null); // ✅ Clear reply after sending
  };

  // ✅ Handle Long Press for Mobile / Right Click for Desktop
  const handleContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    setReplyTo(msg);
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] rounded-xl overflow-hidden"> {/* WhatsApp Background Color */}
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => {
          const isMe = msg.senderId === session?.user?.id;
          return (
            <div 
              key={msg.id} 
              onContextMenu={(e) => handleContextMenu(e, msg)} // ✅ Trigger reply
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[75%] p-2 px-3 rounded-lg text-sm shadow-sm relative ${
                isMe ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none" : "bg-white text-gray-900 rounded-tl-none"
              }`}>
                {msg.replyTo && (
                  <div className="border-l-2 border-green-500 pl-2 mb-1 text-xs text-gray-500 italic">
                    Replying to: {msg.replyTo.content.slice(0, 30)}...
                  </div>
                )}
                <p>{msg.content}</p>
                <span className="text-[10px] opacity-70 block mt-1 text-right">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-3 bg-gray-100 flex gap-2 items-end">
        {replyTo && (
          <div className="absolute bottom-16 left-4 right-4 bg-white p-2 rounded-lg shadow-md border-l-4 border-green-500 flex justify-between items-center">
            <div className="text-xs text-gray-500 truncate">Replying to: {replyTo.content}</div>
            <button type="button" onClick={() => setReplyTo(null)}><X className="w-4 h-4" /></button>
          </div>
        )}
        
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border-none rounded-full focus:outline-none focus:ring-0 bg-white shadow-sm"
        />
        <button type="submit" className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition shadow-sm">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}