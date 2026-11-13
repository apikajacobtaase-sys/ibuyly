"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import { useCartStore } from "@/store/cartStore";

export default function ConciergePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);

  const [messages, setMessages] = useState<{ role: string; content: string; products?: any[] }[]>([
    { role: "assistant", content: "Hello! I'm your iBUY Concierge. Tell me what you're looking for today (e.g., 'I need a laptop for college under 5000 GHS')." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [sessionId] = useState(() => uuidv4());
 const trackProductClick = (product: any) => {
  if (!product?.id || !product?.offerId) return;

  void fetch("/api/concierge/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: product.id,
      offerId: product.offerId,
    }),
    keepalive: true,
  }).catch((error) => {
    console.error("Product click tracking failed:", error);
  });
};
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

const initialQuestionSent = useRef(false);

useEffect(() => {
  const question = searchParams.get("q")?.trim();

  if (!question || initialQuestionSent.current || status !== "authenticated") {
    return;
  }

  initialQuestionSent.current = true;

  setInput(question);

  const submitQuestion = async () => {
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          conversationHistory: messages.slice(-6),
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "I couldn't process that request. Please try again.",
          products: data.products || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  submitQuestion();
}, [searchParams, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.slice(-6), // Keep context manageable
        }),
      });

      const data = await res.json();

      const aiMessage = { 
        role: "assistant", 
        content: data.reply,
        products: data.products || [] // Attach smart product recommendations
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-xl">Loading Concierge...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl">🤖</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">iBUY Concierge</h1>
            <p className="text-sm text-gray-500">Powered by Intelligent Commerce</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="relative p-2 text-gray-600 hover:text-indigo-600 transition text-2xl">
            🛒
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {items.length}
              </span>
            )}
          </Link>
          <button onClick={() => router.push("/dashboard")} className="text-indigo-600 hover:underline font-medium">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              
              {/* Text Bubble */}
              <div className={`rounded-2xl px-5 py-3 shadow-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
              }`}>
                <p className="text-sm md:text-base leading-relaxed">{msg.content}</p>
              </div>

              {/* 👇 SAFE PRODUCT CARDS RENDERING (Only runs if products exist and length > 0) */}
              {msg.role === "assistant" && msg.products && msg.products.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {msg.products.map((product: any) => {
                    // Get the primary image safely
                    const primaryImage = product.images?.find((img: any) => img.isPrimary) || product.images?.[0];
                    
                    return (
                      <div
  key={product.id}
  role="link"
  tabIndex={0}
  
  onKeyDown={(event) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      trackProductClick(product);
      router.push(`/products/${product.slug || product.id}`);
    }
  }}
  className="cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
>
          {primaryImage && (
  <div className="block relative h-48 bg-gray-100">
    <img
      src={primaryImage.url}
      alt={product.title}
      className="w-full h-full object-cover"
    />
  </div>
)}
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-900 text-sm line-clamp-2">
  {product.title}
</h3>
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ml-2">
                              GHS {Number(product.price).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                          <div className="flex justify-between items-center text-xs text-gray-600 mb-3">
                            <span>🏪 {product.sellerName || "iBUY Store"}</span>
                            <span>📦 {product.stockQuantity} in stock</span>
                          </div>
                         <button
  onClick={async (event) => {
    event.stopPropagation();
  if (
    !product.variantId ||
    !product.offerId ||
    !product.sellerId ||
    product.stockQuantity < 1
  ) {
    alert("This offer is unavailable. Please refresh your search.");
    return;
  }

  try {
    const success = await addItem({
      productId: product.id,
      variantId: product.variantId,
      offerId: product.offerId,
      sellerId: product.sellerId,
      title: product.title,
      price: Number(product.price),
      quantity: 1,
      imageUrl: product.imageUrl ?? undefined,
      slug: product.slug,
      stockQuantity: product.stockQuantity,
      sellerName: product.sellerName,
    });

    if (success) {
      alert(`Added "${product.title}" to your cart.`);
    } else {
      alert("Unable to add this item. Please check availability and try again.");
    }
  } catch (error) {
    console.error("Concierge add-to-cart failed:", error);
    alert("Unable to add this item. Please try again.");
  }
}}
  
  className="w-full bg-indigo-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-indigo-700 transition active:scale-95"
>
  Add to Cart
</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hint if no products found */}
              {msg.role === "assistant" && msg.products && msg.products.length === 0 && !msg.content.includes("blocked") && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                  💡 I couldn&apos;t find exact matches in the catalog yet. Try adding more products in the Seller Dashboard!
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

          {/* Input Area */}
      <div className="bg-white border-t p-4">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you're looking for..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}