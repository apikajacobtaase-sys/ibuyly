"use client";

import { useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import { Send } from "lucide-react";
import { useSession } from "next-auth/react";

interface ChatMessage {
  id?: string;
senderId: string;
  content: string;
  createdAt: Date | string;
  sender?: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface ChatBoxProps {
  conversationId: string;
  initialMessages: ChatMessage[];
}

export default function ChatBox({
  conversationId,
  initialMessages,
}: ChatBoxProps) {
  const { data: session, status } = useSession();

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.error("Pusher public configuration is missing.");
      return;
    }

    const pusher = new PusherClient(key, {
      cluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });

    const channel = pusher.subscribe(`private-chat-${conversationId}`);

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((current) => {
        if (current.some((item) => item.id && item.id === message.id)) {
          return current;
        }

        return [...current, message];
      });
    };

    channel.bind("new-message", handleNewMessage);

    pusher.connection.bind("error", (connectionError: unknown) => {
      console.error("Pusher connection error:", connectionError);
    });

    return () => {
      channel.unbind("new-message", handleNewMessage);
      pusher.unsubscribe(`private-chat-${conversationId}`);
      pusher.disconnect();
    };
  }, [conversationId, session?.user?.id, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = input.trim();

    if (!content || sending || !session?.user?.id) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          content,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message.");
      }

      if (result.message) {
        setMessages((current) => {
          if (current.some((item) => item.id && item.id === result.message.id)) {
            return current;
          }

          return [...current, result.message];
        });
      }

      setInput("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] rounded-xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => {
          const isMe = msg.senderId === session?.user?.id;

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-2 px-3 rounded-lg text-sm shadow-sm ${
                  isMe
                    ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none"
                    : "bg-white text-gray-900 rounded-tl-none"
                }`}
              >
                {!isMe && msg.sender && (
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    {[msg.sender.firstName, msg.sender.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}

                <p className="whitespace-pre-wrap break-words">
                  {msg.content}
                </p>

                <span className="text-[10px] opacity-70 block mt-1 text-right">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50">
          {error}
        </div>
      )}

      <form
        onSubmit={sendMessage}
        className="p-3 bg-gray-100 flex gap-2 items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          disabled={sending || status !== "authenticated"}
          className="flex-1 min-w-0 px-4 py-2 border-none rounded-full focus:outline-none focus:ring-0 bg-white shadow-sm disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={!input.trim() || sending || status !== "authenticated"}
          className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}