 // src/components/chat/ChatBox.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import PusherClient from "pusher-js";
import { Send, X, CheckCheck } from "lucide-react";
import { useSession } from "next-auth/react";

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  replyTo?: { content: string };
}

export default function ChatBox({ conversationId, initialMessages }: { conversationId: string, initialMessages: Message[] }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ Safe Date Formatter
  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ✅ Initialize Pusher for Real-Time Updates
  useEffect(() => {
    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`chat-${conversationId}`);
    
    channel.bind('new-message', (data: Message) => {
      setMessages((prev) => {
        // Prevent duplicates if the message was already added by the sender
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    return () => {
      pusher.unsubscribe(`chat-${conversationId}`);
    };
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Optimistically add message to UI
    const tempId = Date.now().toString();
    const newMessage = {
      id: tempId,
      content: input,
      senderId: session?.user?.id || "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage as Message]);
    setInput("");
    setReplyTo(null);

    // Send to API
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        conversationId, 
        content: input,
        replyToId: replyTo?.id 
      }),
    });
  };

  // Handle Right-Click / Long-Press for Reply
  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setReplyTo(msg);
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] rounded-xl overflow-hidden relative">
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === session?.user?.id;
          return (
            <div 
              key={msg.id} 
              onContextMenu={(e) => handleContextMenu(e, msg)}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] md:max-w-[60%] p-2 px-3 rounded-lg text-sm shadow-sm relative group ${
                isMe ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none" : "bg-white text-gray-900 rounded-tl-none"
              }`}>
                
                {/* Reply Context */}
                {msg.replyTo && (
                  <div className="border-l-2 border-green-500 pl-2 mb-1 text-xs text-gray-500 italic bg-black/5 rounded p-1">
                    {msg.replyTo.content.slice(0, 40)}...
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] opacity-70">
                    {formatTime(msg.createdAt)}
                  </span>
                  {isMe && <CheckCheck className="w-3 h-3 text-blue-500" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-3 bg-gray-100 flex gap-2 items-end relative">
        
        {/* Reply Preview Bar */}
        {replyTo && (
          <div className="absolute bottom-16 left-2 right-2 bg-white p-2 rounded-lg shadow-md border-l-4 border-green-500 flex justify-between items-center z-10 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-xs text-gray-500 truncate pr-2">
              <span className="font-semibold text-green-600">Replying:</span> {replyTo.content}
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-100 rounded-full">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
        
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 border-none rounded-full focus:outline-none focus:ring-0 bg-white shadow-sm text-sm"
        />
        
        <button 
          type="submit" 
          disabled={!input.trim()}
          className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}