 // src/components/chat/StartChatButton.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  receiverId: string;
  productId: string;
  productName: string;
}

export default function StartChatButton({ receiverId, productId, productName }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId,
          productId,
          content: `Hi, I'm interested in ${productName}. Is it available?`,
        }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to start conversation.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert("Network error.");
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleStart}
      disabled={isLoading}
      className="w-full py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Starting...
        </>
      ) : (
        "Start Conversation"
      )}
    </button>
  );
}