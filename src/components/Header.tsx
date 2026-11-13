 "use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Bell,
  Menu,
  User,
  Sparkles,
  X,
  Send,
  ShoppingCart,
} from "lucide-react";
import Logo from "./Logo";
import { useCartStore } from "@/store/cartStore";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  products?: any[];
};
const CUSTOMER_GREETINGS = [
  "Hey! Welcome to iBUY. What are we shopping for today?",
  "Hello there! Is there something special you're looking for?",
  "Welcome to iBUY! Have something in mind, or would you like some inspiration?",
  "Hi! What can I help you discover today?",
  "Hey there! What would make your shopping experience easier today?",
  "Welcome back! What are we finding for you today?",
  "Hello! Looking for something specific or exploring your options?",
  "Hi there! Tell me what you need, and let's find something great.",
];
export default function Header({
  onMenuToggle,
}: {
  onMenuToggle: () => void;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const addItem = useCartStore((state) => state.addItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = session?.user?.avatarUrl || session?.user?.image;
  const displayName = session?.user?.name || "Account";

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchActive(false);
  };
const openAI = () => {
  const search = searchQuery.trim();

  setAiInput(search);

  // Generate an opening greeting only for a new conversation.
  if (messages.length === 0) {
    const greeting = search
      ? `I see you're exploring "${search}". What matters most to you: price, quality, features, or something else?`
      : CUSTOMER_GREETINGS[
          Math.floor(Math.random() * CUSTOMER_GREETINGS.length)
        ];

    setMessages([
      {
        role: "assistant",
        content: greeting,
      },
    ]);
  }

  setAiOpen(true);
  setSearchActive(false);
};


  const sendAIMessage = async (message?: string) => {
    const question = (message ?? aiInput).trim();

    if (!question || aiLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    const previousMessages = messages;

    setMessages((prev) => [...prev, userMessage]);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          conversationHistory: previousMessages.slice(-6),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to contact iBUY AI.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Here are some products you might like.",
          products: data.products || [],
        },
      ]);
    } catch (error) {
      console.error("iBUY AI error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

 const handleAddToCart = async (product: any) => {
  if (
    !product.variantId ||
    !product.offerId ||
    !product.sellerId ||
    product.stockQuantity < 1
  ) {
    toast.error("Product unavailable", {
      description: "This offer is currently unavailable.",
    });
    return;
  }

  try {
    const success = await addItem({
      productId: product.productId || product.id,
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
      toast.success("Added to cart", {
        description: `${product.title} has been added to your cart.`,
      });
    } else {
      toast.error("Unable to add to cart", {
        description: "Please try again.",
      });
    }
  } catch (error) {
    console.error("AI cart error:", error);

    toast.error("Unable to add to cart", {
      description: "Something went wrong. Please try again.",
    });
  }
};

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/notifications?unreadOnly=true");
        const data = await res.json();

        if (res.ok) {
          setUnreadNotifications(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, aiLoading]);

  useEffect(() => {
    if (!aiOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiOpen(false);
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [aiOpen]);

  const ProfileAvatar = ({ size = "h-9 w-9" }: { size?: string }) => (
    <div
      className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-bold text-gray-700`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-3 py-2">
          {/* Menu and logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Logo />
          </div>

          {/* Account actions */}
          <div className="flex items-center gap-2">
            {status === "unauthenticated" && (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white md:hidden"
                >
                  <User className="h-3 w-3" />
                  Log In
                </Link>

                <Link
                  href="/login"
                  className="hidden min-h-10 items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white md:inline-flex"
                >
                  <User className="h-4 w-4" />
                  Log In
                </Link>
              </>
            )}

            {status === "authenticated" && (
              <>
                <Link
                  href="/account/settings"
                  className="rounded-full md:hidden"
                  aria-label="Profile settings"
                >
                  <ProfileAvatar />
                </Link>

                <div className="hidden items-center gap-3 md:flex">
                  <Link
                    href="/account/notifications"
                    className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />

                    {unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-rose-600 px-0.5 text-[9px] font-bold text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/account/settings"
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ProfileAvatar size="h-8 w-8" />
                    <span className="max-w-28 truncate">{displayName}</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Single intelligent search bar */}
        <div className="px-3 pb-3">
          <div className="relative mx-auto max-w-3xl">
            <form
              onSubmit={handleSearch}
              className={`flex items-center rounded-xl border bg-gray-100 transition ${
                searchActive
                  ? "border-indigo-400 bg-white shadow-sm"
                  : "border-transparent"
              }`}
            >
              <Search className="ml-3 h-5 w-5 shrink-0 text-gray-400" />

              <input
                ref={inputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchActive(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchActive(false);
                    inputRef.current?.blur();
                  }
                }}
                placeholder="Search products, brands or anything..."
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                aria-label="Search products"
              />

              {searchActive && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openAI}
                  className="mr-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 sm:text-sm"
                >
                  <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Ask iBUY AI</span>
<span className="sm:hidden">Ask AI</span>
                </button>
              )}
            </form>
          </div>
        </div>
      </header>

      {/* AI shopping overlay */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 md:items-start md:pt-20"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAiOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="iBUY AI shopping assistant"
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl md:h-[min(720px,calc(100dvh-120px))] md:max-w-2xl md:rounded-2xl md:border"
          >
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-bold text-gray-900">iBUY AI</h2>
                  <p className="text-xs text-gray-500">
                    Your intelligent shopping assistant
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAiOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close AI assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conversation */}
            <div className="flex-1 space-y-5 overflow-y-auto bg-gray-50 p-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] ${
                      message.role === "user" ? "w-fit" : "w-full"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "ml-auto rounded-br-sm bg-indigo-600 text-white"
                          : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.role === "assistant" &&
                      message.products &&
                      message.products.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                           {message.products.map((product, productIndex) => {
  const productHref = `/products/${product.slug || product.id}`;

  return (
    <div
      key={`${product.id}-${productIndex}`}
      role="link"
      tabIndex={0}
      onClick={() => {
        setAiOpen(false);
        router.push(productHref);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setAiOpen(false);
          router.push(productHref);
        }
      }}
      className="cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-400 hover:shadow-md"
    >
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title}
          className="h-36 w-full cursor-pointer bg-white object-contain p-2"
        />
      )}

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {product.title}
        </h3>

        <p className="font-bold text-indigo-700">
          GH₵ {Number(product.price).toLocaleString("en-GH")}
        </p>

        {product.reason && (
          <p className="text-xs text-gray-500">
            {product.reason}
          </p>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart(product);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </button>
      </div>
    </div>
  );
})}
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border bg-white px-4 py-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((item) => (
                        <span
                          key={item}
                          className="h-2 w-2 animate-bounce rounded-full bg-indigo-500"
                          style={{ animationDelay: `${item * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts */}
            {messages.length === 1 && (
              <div className="flex gap-2 overflow-x-auto border-t bg-white px-3 py-3">
                {[
                  "Find me a laptop",
                  "Best phones under GH₵3,000",
                  "I need something for university",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendAIMessage(prompt)}
                    className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Message input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendAIMessage();
              }}
              className="flex items-center gap-2 border-t bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Describe what you're looking for..."
                disabled={aiLoading}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />

              <button
                type="submit"
                disabled={aiLoading || !aiInput.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}