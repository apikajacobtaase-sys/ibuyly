 "use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUp,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useCompareStore } from "@/store/compareStore";

interface ProductData {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number;
  bestOfferId: string | null;
  bestVariantId: string | null;
  attributes: Record<string, unknown>;
  sellerName: string | null;
  sellerLogoUrl: string | null;
  sellerId: string | null;
  sellerVerified: boolean;
  sellerTrustScore: number | null;
  sellerRating: number | null;
  sellerFulfillmentRate: number | null;
  sellerReturnRate: number | null;
  sellerTotalOrders: number;
  categoryName: string;
  categorySlug: string;
  avgRating: number | null;
  reviewCount: number;
  createdAt: string;
}

interface ComparisonAnalysis {
  summary: string;
  bestOverallProductId: string | null;
  bestValueProductId: string | null;
  productAnalyses: {
    productId: string;
    strengths: string[];
    weaknesses: string[];
    verdict: string;
  }[];
  buyingRecommendation: string;
  caveats: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  hasDiscovery?: boolean;
  attachments?: {
    id: string;
    title: string;
    imageUrl?: string | null;
  }[];
}

interface SavedConversation {
  sessionId: string;
  title: string;
  updatedAt: string;
  messages?: ChatMessage[];
  productIds?: string[];
}

interface SuggestedProduct {
  id: string;
  title: string;
  categoryName: string;
  imageUrl?: string | null;
  categorySlug: string;
  price: number | null;
}

interface SuggestedCategory {
  name: string;
  slug: string;
  productCount: number;
  products: {
    id: string;
    title: string;
    price: number | null;
  }[];
}

interface CatalogueProduct {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  imageUrl: string | null;
  originalPrice?: number | null;
  stockQuantity?: number;
  sellerName?: string | null;
  inStock?: boolean;
}

const money = (value: number | null) =>
  value === null
    ? "Price unavailable"
    : `GH₵${value.toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "string" && !value.trim()) return false;
  if (Array.isArray(value)) return value.some(hasValue);

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasValue);
  }

  return true;
};

const formatValue = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => hasValue(item))
      .map(([key, item]) => `${key}: ${formatValue(item)}`)
      .join(" · ");
  }

  return String(value);
};

const isConversationalMessage = (message: string) =>
  /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|how are you doing|what can you do|who are you|help|thanks|thank you|thank you so much|goodbye|bye|ok|okay)[!.?,\s]*$/i.test(
    message.trim()
  );

export default function ComparePage() {
  const { data: session, status } = useSession();
  const { items, addItem, removeItem, clearCompare } = useCompareStore();

  const userId = session?.user?.id || null;
  const isLoggedIn = status === "authenticated" && !!userId;

  const [products, setProducts] = useState<ProductData[]>([]);
  const [discoveredProducts, setDiscoveredProducts] = useState<ProductData[]>(
    []
  );
  const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null);

  const [suggestedProducts, setSuggestedProducts] = useState<
    SuggestedProduct[]
  >([]);
  const [suggestedCategories, setSuggestedCategories] = useState<
    SuggestedCategory[]
  >([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const [history, setHistory] = useState<SavedConversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showSpecifications, setShowSpecifications] = useState(true);

  // Catalogue state
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueProducts, setCatalogueProducts] = useState<
    CatalogueProduct[]
  >([]);
  const [cataloguePage, setCataloguePage] = useState(1);
  const [catalogueHasMore, setCatalogueHasMore] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [clarification, setClarification] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const previousUserId = useRef<string | null>(null);
  const initialized = useRef(false);
  const catalogueRequest = useRef(0);

  const createSessionId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  useEffect(() => {
    if (status === "loading") return;

    if (!initialized.current) {
      initialized.current = true;
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current !== userId) {
      setMessages([]);
      setHistory([]);
      setProducts([]);
      setDiscoveredProducts([]);
      setAnalysis(null);
      setActiveSessionId("");
      setError("");
      setAnalysisError("");
      setClarification("");
      setSuggestedProducts([]);
      setSuggestedCategories([]);

      previousUserId.current = userId;
    }
  }, [userId, status]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;

    try {
      const res = await fetch("/api/compare/history", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();

      setHistory(
        Array.isArray(data.conversations)
          ? data.conversations.slice(0, 5)
          : []
      );
    } catch (err) {
      console.error("Failed to load comparison history:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (isLoggedIn) loadHistory();
  }, [isLoggedIn, loadHistory]);

  // Search the public product catalogue.
  const fetchCatalogue = useCallback(
    async (page: number, query: string, append = false) => {
      const requestId = ++catalogueRequest.current;

      setCatalogueLoading(true);
      setCatalogueError("");

      try {
        const params = new URLSearchParams({
          q: query,
          page: String(page),
          limit: "20",
        });

        const res = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to load the catalogue.");
        }

        // Ignore older requests if the search has changed.
        if (requestId !== catalogueRequest.current) return;

        const fetched: CatalogueProduct[] = data.products || [];

        setCatalogueProducts((current) =>
          append ? [...current, ...fetched] : fetched
        );

        setCataloguePage(data.page || page);
        setCatalogueHasMore(Boolean(data.hasMore));
      } catch (err) {
        if (requestId === catalogueRequest.current) {
          setCatalogueError(
            err instanceof Error
              ? err.message
              : "Unable to load catalogue products."
          );
        }
      } finally {
        if (requestId === catalogueRequest.current) {
          setCatalogueLoading(false);
        }
      }
    },
    []
  );

  // Load catalogue products when the modal opens or search changes.
  useEffect(() => {
    if (!showCatalogue) return;

    const timeout = setTimeout(() => {
      setCatalogueProducts([]);
      setCataloguePage(1);
      fetchCatalogue(1, catalogueSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [showCatalogue, catalogueSearch, fetchCatalogue]);

  const openCatalogue = () => {
    setShowCatalogue(true);
    setCatalogueSearch("");
    setCatalogueProducts([]);
    setCatalogueError("");
  };

  const addCatalogueProduct = (product: CatalogueProduct) => {
    if (items.some((item) => item.id === product.id)) return;

    if (items.length >= 4) {
      setCatalogueError("You can compare a maximum of four products.");
      return;
    }

    addItem({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price ?? 0,
      imageUrl: product.imageUrl ?? null,
    });

    setError("");
    setCatalogueError("");
  };

  const fetchProductsByIds = async (
    ids: string[]
  ): Promise<ProductData[]> => {
    const uniqueIds = [...new Set(ids)].filter(Boolean).slice(0, 8);

    if (!uniqueIds.length) return [];

    const results: ProductData[] = [];

    for (let i = 0; i < uniqueIds.length; i += 4) {
      const batch = uniqueIds.slice(i, i + 4);

      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: batch,
          hydrateOnly: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to restore products.");
      }

      results.push(...(data.products || []));
    }

    const productMap = new Map(
      results.map((product) => [product.id, product])
    );

    return uniqueIds
      .map((id) => productMap.get(id))
      .filter((product): product is ProductData => !!product);
  };

  const saveDiscoveryExchange = async (
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
    discoveredIds: string[]
  ) => {
    if (!isLoggedIn || !sessionId) return;

    try {
      const res = await fetch("/api/compare/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage,
          assistantMessage,
          discoveredProductIds: discoveredIds,
          selectedProductIds: items.map((item) => item.id),
        }),
      });

      if (!res.ok) {
        console.error("Unable to save discovery exchange:", await res.text());
        return;
      }

      await loadHistory();
    } catch (err) {
      console.error("Failed to save discovery exchange:", err);
    }
  };

  const comparisonRows = useMemo(() => {
    const keys = new Set<string>();

    products.forEach((product) => {
      Object.entries(product.attributes || {}).forEach(([key, value]) => {
        if (hasValue(value)) keys.add(key);
      });
    });

    return Array.from(keys)
      .map((key) => ({
        key,
        values: products.map((product) => product.attributes?.[key]),
      }))
      .filter((row) => row.values.some(hasValue));
  }, [products]);

  const fetchSelectedProducts = async () => {
    if (items.length < 2 || isLoading) return;

    setIsLoading(true);
    setIsAnalyzing(true);
    setError("");
    setAnalysisError("");

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: items.map((item) => item.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to compare products.");
      }

      const fetchedProducts: ProductData[] = data.products || [];

      setProducts(fetchedProducts);

      if (fetchedProducts.length < 2) {
        setError("At least two active products are required.");
        setAnalysis(null);
        return;
      }

      const analysisRes = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: fetchedProducts.map((product) => product.id),
          includeAnalysis: true,
        }),
      });

      const analysisData = await analysisRes.json();

      if (analysisRes.ok) {
        setAnalysis(analysisData.analysis || null);
        setAnalysisError(analysisData.analysisError || "");
      } else {
        setAnalysisError(
          analysisData.error || "Unable to generate comparison analysis."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if ((!input.trim() && items.length === 0) || isSending || isLoading) {
      return;
    }

    const message =
      input.trim() ||
      "Compare the selected products and highlight their key differences.";

    const selectedItems = items.slice(0, 4);

    const selectedAttachments = selectedItems.map((item) => ({
      id: item.id,
      title: item.title,
      imageUrl: item.imageUrl ?? null,
    }));

    const updatedMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: message,
        attachments: selectedAttachments.length
          ? selectedAttachments
          : undefined,
      },
    ];

    const sessionId = activeSessionId || createSessionId();
    const selectedIds = selectedItems.map((item) => item.id);

    setActiveSessionId(sessionId);
    setMessages(updatedMessages);
    setInput("");
    setIsSending(true);
    setError("");
    setClarification("");

    try {
      let currentProducts = products;

      if (selectedIds.length >= 2) {
        const comparisonRes = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: selectedIds,
            includeAnalysis: true,
          }),
        });

        const comparisonData = await comparisonRes.json();

        if (!comparisonRes.ok) {
          throw new Error(
            comparisonData.error || "Unable to compare selected products."
          );
        }

        currentProducts = comparisonData.products || [];

        setProducts(currentProducts);
        setAnalysis(comparisonData.analysis || null);
        setAnalysisError(comparisonData.analysisError || "");
        setDiscoveredProducts([]);
        setSuggestedProducts([]);
        setSuggestedCategories([]);

        if (currentProducts.length < 2) {
          throw new Error("At least two active products are required.");
        }
      }

      if (
        selectedIds.length < 2 &&
        currentProducts.length < 2 &&
        !isConversationalMessage(message)
      ) {
        const discoveryRes = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            productIds: selectedIds,
            includeAnalysis: true,
          }),
        });

        const discoveryData = await discoveryRes.json();

        if (!discoveryRes.ok) {
          throw new Error(
            discoveryData.error || "Unable to find matching products."
          );
        }

        const discovered: ProductData[] = discoveryData.products || [];

        const reply =
          discoveryData.clarification ||
          (discovered.length
            ? "I've found matching products. Add the products you'd like to compare, or ask me a question about them."
            : "I couldn't find matching products. Could you provide more details?");

        setDiscoveredProducts(discovered);
        setAnalysis(discoveryData.analysis || null);
        setAnalysisError(discoveryData.analysisError || "");
        setClarification(discoveryData.clarification || "");
        setSuggestedProducts(discoveryData.suggestedProducts || []);
        setSuggestedCategories(discoveryData.suggestedCategories || []);

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: reply,
            hasDiscovery: true,
          },
        ]);

        await saveDiscoveryExchange(
          sessionId,
          message,
          reply,
          discovered.map((product) => product.id)
        );

        return;
      }

      const discoveredIds = discoveredProducts.map(
        (product) => product.id
      );

      const contextIds = [
        ...new Set([
          ...selectedIds,
          ...currentProducts.map((product) => product.id),
          ...discoveredIds,
        ]),
      ].slice(0, 8);

      const chatRes = await fetch("/api/compare/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message,
          productIds: contextIds,
          selectedProductIds: selectedIds,
          discoveredProductIds: discoveredIds,
          conversationHistory: updatedMessages.slice(-12),
        }),
      });

      const chatData = await chatRes.json();

      if (!chatRes.ok) {
        throw new Error(chatData.error || "Unable to get an AI response.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: chatData.reply,
        },
      ]);

      if (chatData.sessionId) {
        setActiveSessionId(chatData.sessionId);
      }

      if (isLoggedIn) await loadHistory();
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "I'm having trouble responding. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const openConversation = async (conversation: SavedConversation) => {
    setIsLoading(true);
    setIsAnalyzing(false);
    setShowHistory(false);
    setError("");
    setAnalysisError("");
    setClarification("");

    try {
      const res = await fetch(
        `/api/compare/history?sessionId=${encodeURIComponent(
          conversation.sessionId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to open conversation.");
      }

      const selectedIds: string[] = data.selectedProductIds || [];

      const discoveredIds: string[] =
        data.discoveredProductIds?.length
          ? data.discoveredProductIds
          : data.productIds || [];

      const allIds = [...new Set([...selectedIds, ...discoveredIds])];

      const restoredProducts = await fetchProductsByIds(allIds);

      const productMap = new Map(
        restoredProducts.map((product) => [product.id, product])
      );

      const restoredSelected = selectedIds
        .map((id) => productMap.get(id))
        .filter((product): product is ProductData => !!product);

      const restoredDiscovered = discoveredIds
        .map((id) => productMap.get(id))
        .filter((product): product is ProductData => !!product);

      clearCompare();

      restoredSelected.forEach((product) => {
        addItem({
          id: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price ?? 0,
          imageUrl: product.imageUrl ?? null,
        });
      });

      setActiveSessionId(conversation.sessionId);
      setMessages(data.messages || []);
      setProducts(restoredSelected);
      setDiscoveredProducts(restoredDiscovered);
      setAnalysis(null);
      setSuggestedProducts([]);
      setSuggestedCategories([]);

      if (restoredSelected.length >= 2) {
        setIsAnalyzing(true);

        const analysisRes = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: restoredSelected.map((product) => product.id),
            includeAnalysis: true,
          }),
        });

        const analysisData = await analysisRes.json();

        if (analysisRes.ok) {
          setAnalysis(analysisData.analysis || null);
          setAnalysisError(analysisData.analysisError || "");
        } else {
          setAnalysisError(
            analysisData.error || "Unable to restore comparison analysis."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to open conversation."
      );
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const addSuggestedProduct = (product: SuggestedProduct) => {
    if (items.some((item) => item.id === product.id)) return;

    if (items.length >= 4) {
      setError("You can compare a maximum of four products.");
      return;
    }

    addItem({
      id: product.id,
      title: product.title,
      slug: product.id,
      imageUrl: product.imageUrl ?? null,
      price: product.price ?? 0,
    });

    setError("");
  };

  const handleRemoveProduct = (id: string) => {
    removeItem(id);
    setProducts((current) => current.filter((product) => product.id !== id));
    setAnalysis(null);
  };

  const clearCurrentComparison = () => {
    clearCompare();
    setProducts([]);
    setAnalysis(null);
    setError("");
    setAnalysisError("");
  };

  const startNewChat = () => {
    setProducts([]);
    setDiscoveredProducts([]);
    setAnalysis(null);
    setMessages([]);
    setActiveSessionId("");
    setError("");
    setAnalysisError("");
    setClarification("");
    setSuggestedProducts([]);
    setSuggestedCategories([]);
    setShowHistory(false);
  };

  const renderCell = (value: unknown) => {
    if (!hasValue(value)) {
      return <span className="text-slate-300">—</span>;
    }

    return (
      <span className="text-sm text-slate-700">{formatValue(value)}</span>
    );
  };

  const isComparing = products.length >= 2;

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-orange-500" size={20} />
                <h1 className="text-base font-bold tracking-tight">
                  iBUY Compare
                </h1>
              </div>
              <p className="text-[11px] text-slate-500">
                AI-powered shopping intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                onClick={() => setShowHistory((value) => !value)}
                className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Clock size={15} />
                <span className="hidden sm:inline">History</span>
              </button>
            )}

            <button
              onClick={startNewChat}
              className="flex h-9 items-center gap-2 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white hover:bg-orange-600"
            >
              <Plus size={15} />
              New chat
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Conversation history */}
        {showHistory && isLoggedIn && (
          <aside className="fixed inset-0 z-50 bg-slate-950/30 md:sticky md:top-16 md:h-[calc(100vh-64px)] md:w-72 md:shrink-0 md:bg-transparent">
            <div className="h-full w-[min(85%,320px)] border-r border-slate-200 bg-white p-4 shadow-xl md:w-full md:shadow-none">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Your conversations</h2>
                  <p className="text-xs text-slate-500">
                    Your latest five comparisons
                  </p>
                </div>

                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-lg p-2 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                onClick={startNewChat}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-600"
              >
                <Plus size={16} />
                Start a new comparison
              </button>

              <div className="space-y-2">
                {history.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                    Your saved conversations will appear here.
                  </p>
                )}

                {history.map((conversation) => (
                  <button
                    key={conversation.sessionId}
                    onClick={() => openConversation(conversation)}
                    className={`w-full rounded-xl p-3 text-left transition ${
                      activeSessionId === conversation.sessionId
                        ? "bg-orange-50 ring-1 ring-orange-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageCircle
                        size={16}
                        className="mt-0.5 shrink-0 text-orange-500"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {conversation.title || "Product comparison"}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                          {new Date(
                            conversation.updatedAt
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Main workspace */}
        <section className="min-w-0 flex-1 px-4 pb-48 pt-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            {/* Welcome */}
            {!isComparing && messages.length === 0 && (
              <div className="mx-auto max-w-2xl pt-10 text-center sm:pt-20">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-100 text-orange-500">
                  <BrainCircuit size={32} />
                </div>

                <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600">
                  <Sparkles size={13} />
                  iBUY Shopping Intelligence
                </span>

                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Make smarter buying decisions.
                </h2>

                <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
                  Tell me what you're shopping for. I'll find matching
                  products, compare their available details and help you
                  decide what is worth buying.
                </p>

                <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
                  {[
                    {
                      title: "Compare phones",
                      description: "Find the right phone for your budget.",
                      prompt: "Compare smartphones under GH₵3000",
                    },
                    {
                      title: "Find best value",
                      description: "Balance price and available features.",
                      prompt: "Find me the best value laptops",
                    },
                    {
                      title: "Compare quality",
                      description:
                        "Understand the differences between products.",
                      prompt:
                        "Help me compare product quality and reliability",
                    },
                  ].map((suggestion) => (
                    <button
                      key={suggestion.title}
                      onClick={() => setInput(suggestion.prompt)}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-orange-300 hover:shadow-sm"
                    >
                      <Sparkles
                        size={17}
                        className="mb-3 text-orange-500"
                      />
                      <p className="text-sm font-bold">{suggestion.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {suggestion.description}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={openCatalogue}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-600 transition hover:bg-orange-100"
                >
                  <Search size={17} />
                  Browse product catalogue
                </button>
              </div>
            )}

            {/* Selected comparison */}
            {isComparing && (
              <>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
                      Your comparison
                    </p>
                    <h2 className="mt-1 text-xl font-bold">
                      {products.length} products side by side
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openCatalogue}
                      className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600"
                    >
                      <Plus size={15} />
                      Add products
                    </button>

                    <button
                      onClick={clearCurrentComparison}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-500"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  </div>
                </div>

                {/* Product cards */}
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {products.map((product) => {
                    const isBest =
                      analysis?.bestOverallProductId === product.id;

                    return (
                      <article
                        key={product.id}
                        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        {isBest && (
                          <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-[9px] font-bold text-white">
                            <Trophy size={10} />
                            BEST OVERALL
                          </span>
                        )}

                        <button
                          onClick={() => handleRemoveProduct(product.id)}
                          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-red-500"
                          aria-label={`Remove ${product.title}`}
                        >
                          <X size={14} />
                        </button>

                        <Link href={`/products/${product.slug}`}>
                          <div className="relative mb-3 mt-5 aspect-square overflow-hidden rounded-xl bg-slate-50">
                            {product.imageUrl ? (
                              <Image
                                src={product.imageUrl}
                                alt={product.title}
                                fill
                                sizes="(max-width: 640px) 45vw, 200px"
                                className="object-contain p-2"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                No image
                              </div>
                            )}
                          </div>

                          <h3 className="line-clamp-2 min-h-10 text-xs font-bold leading-5 text-slate-800 sm:text-sm">
                            {product.title}
                          </h3>
                        </Link>

                        <p className="mt-2 text-sm font-extrabold text-orange-600">
                          {money(product.price)}
                        </p>

                        {product.compareAtPrice !== null &&
                          product.price !== null &&
                          product.compareAtPrice > product.price && (
                            <p className="mt-1 text-[10px] text-slate-400 line-through">
                              {money(product.compareAtPrice)}
                            </p>
                          )}

                        <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500">
                          <Star
                            size={12}
                            className="fill-amber-400 text-amber-400"
                          />
                          {product.avgRating !== null
                            ? product.avgRating.toFixed(1)
                            : "No rating"}
                          <span>({product.reviewCount})</span>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                          {product.sellerVerified && (
                            <ShieldCheck
                              size={13}
                              className="shrink-0 text-green-600"
                            />
                          )}

                          <span className="truncate text-[10px] text-slate-500">
                            {product.sellerName || "Seller unavailable"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* AI analysis */}
                <section className="mb-6 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-orange-100 bg-orange-50/70 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
                      <BrainCircuit size={21} />
                    </div>

                    <div>
                      <h3 className="font-bold">
                        AI Shopping Intelligence
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Analysis based on available product information
                      </p>
                    </div>

                    {isAnalyzing && (
                      <div className="ml-auto flex items-center gap-2 text-xs text-orange-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                        Analysing
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    {analysis ? (
                      <>
                        <p className="text-sm leading-7 text-slate-700">
                          {analysis.summary}
                        </p>

                        {analysis.buyingRecommendation && (
                          <div className="rounded-xl bg-green-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-green-800">
                              <CheckCircle2 size={17} />
                              Buying recommendation
                            </div>

                            <p className="text-sm leading-6 text-green-900">
                              {analysis.buyingRecommendation}
                            </p>
                          </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                          {analysis.productAnalyses.map((item) => {
                            const product = products.find(
                              (p) => p.id === item.productId
                            );

                            if (!product) return null;

                            return (
                              <div
                                key={item.productId}
                                className="rounded-xl border border-slate-200 p-4"
                              >
                                <h4 className="text-sm font-bold">
                                  {product.title}
                                </h4>

                                <p className="mt-2 text-xs leading-5 text-slate-600">
                                  {item.verdict}
                                </p>

                                {item.strengths.length > 0 && (
                                  <div className="mt-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-green-700">
                                      Strengths
                                    </p>

                                    {item.strengths.map((strength, index) => (
                                      <p
                                        key={index}
                                        className="mb-1 flex gap-2 text-xs text-slate-600"
                                      >
                                        <Check
                                          size={13}
                                          className="shrink-0 text-green-600"
                                        />
                                        {strength}
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {item.weaknesses.length > 0 && (
                                  <div className="mt-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-red-600">
                                      Limitations
                                    </p>

                                    {item.weaknesses.map((weakness, index) => (
                                      <p
                                        key={index}
                                        className="mb-1 text-xs text-slate-600"
                                      >
                                        • {weakness}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {analysis.caveats.length > 0 && (
                          <div className="rounded-xl bg-amber-50 p-4">
                            <p className="mb-2 text-xs font-bold text-amber-800">
                              Important considerations
                            </p>

                            {analysis.caveats.map((caveat, index) => (
                              <p
                                key={index}
                                className="mb-1 text-xs leading-5 text-amber-900"
                              >
                                • {caveat}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">
                        {analysisError ||
                          (isAnalyzing
                            ? "Our AI is analysing the available product information..."
                            : "Your comparison analysis will appear here.")}
                      </p>
                    )}
                  </div>
                </section>

                {/* Product specifications */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    onClick={() =>
                      setShowSpecifications((current) => !current)
                    }
                    className="flex w-full items-center justify-between border-b border-slate-100 p-4 text-left"
                  >
                    <div>
                      <h3 className="font-bold">Product specifications</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Only specifications with available data are shown.
                      </p>
                    </div>

                    <ChevronDown
                      size={18}
                      className={`transition ${
                        showSpecifications ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showSpecifications && (
                    <div className="overflow-x-auto">
                      <div
                        className="min-w-[600px]"
                        style={{
                          display: "grid",
                          gridTemplateColumns: `140px repeat(${products.length}, minmax(150px, 1fr))`,
                        }}
                      >
                        <div className="bg-slate-50 p-3 text-xs font-bold text-slate-500">
                          SPECIFICATION
                        </div>

                        {products.map((product) => (
                          <div
                            key={product.id}
                            className="border-l border-slate-100 bg-slate-50 p-3 text-xs font-bold"
                          >
                            {product.title}
                          </div>
                        ))}

                        {comparisonRows.map((row) => (
                          <div key={row.key} className="contents">
                            <div className="border-t border-slate-100 bg-slate-50/70 p-3 text-xs font-semibold capitalize text-slate-600">
                              {row.key.replace(/([A-Z])/g, " $1")}
                            </div>

                            {row.values.map((value, index) => (
                              <div
                                key={`${row.key}-${index}`}
                                className="border-l border-t border-slate-100 p-3"
                              >
                                {renderCell(value)}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      {comparisonRows.length === 0 && (
                        <p className="p-6 text-center text-sm text-slate-500">
                          No comparable specifications are available.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Errors and clarification */}
            {(error || clarification) && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {error || clarification}
              </div>
            )}

            {/* Conversation */}
            {messages.length > 0 && (
              <section className="mt-8">
                <div className="mb-5 flex items-center gap-2">
                  <BrainCircuit size={18} className="text-orange-500" />
                  <h3 className="text-sm font-bold">
                    Conversation with iBUY AI
                  </h3>
                </div>

                <div className="space-y-5">
                  {messages.map((message, index) => (
                    <div key={`${index}-${message.role}`}>
                      <div
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                            <BrainCircuit size={17} />
                          </div>
                        )}

                        <div
                          className={`max-w-[90%] min-w-0 overflow-hidden rounded-2xl px-3 py-3 text-sm leading-6 sm:max-w-[85%] sm:px-4 ${
                            message.role === "user"
                              ? "rounded-br-md bg-orange-500 text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"
                          }`}
                        >
                          {message.attachments &&
                            message.attachments.length > 0 && (
                              <div className="mb-3 grid grid-cols-2 gap-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="min-w-0 overflow-hidden rounded-xl bg-white/95 p-2 text-slate-800"
                                  >
                                    {attachment.imageUrl ? (
                                      <Image
                                        src={attachment.imageUrl}
                                        alt={attachment.title}
                                        width={160}
                                        height={120}
                                        className="h-24 w-full rounded-lg object-contain"
                                      />
                                    ) : (
                                      <div className="flex h-24 items-center justify-center rounded-lg bg-slate-100">
                                        <BrainCircuit
                                          className="text-slate-400"
                                          size={24}
                                        />
                                      </div>
                                    )}

                                    <p className="mt-2 line-clamp-2 break-words text-xs font-semibold">
                                      {attachment.title}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {message.content}
                          </p>
                        </div>
                      </div>

                      {/* Discovery results */}
                      {message.role === "assistant" &&
                        message.hasDiscovery && (
                          <div className="ml-11 mt-4 space-y-6">
                            {discoveredProducts.length > 0 && (
                              <div>
                                <h4 className="mb-3 text-sm font-bold text-slate-800">
                                  Products matching your request
                                </h4>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {discoveredProducts.map((product) => {
                                    const selected = items.some(
                                      (item) => item.id === product.id
                                    );

                                    return (
                                      <article
                                        key={product.id}
                                        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                                      >
                                        <Link
                                          href={`/products/${product.slug}`}
                                        >
                                          <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-slate-50">
                                            {product.imageUrl ? (
                                              <Image
                                                src={product.imageUrl}
                                                alt={product.title}
                                                fill
                                                sizes="(max-width: 640px) 45vw, 200px"
                                                className="object-contain p-2"
                                              />
                                            ) : (
                                              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                                No image
                                              </div>
                                            )}
                                          </div>

                                          <h5 className="line-clamp-2 min-h-10 text-xs font-bold">
                                            {product.title}
                                          </h5>
                                        </Link>

                                        <p className="mt-2 text-sm font-extrabold text-orange-600">
                                          {money(product.price)}
                                        </p>

                                        <button
                                          onClick={() => {
                                            if (selected) {
                                              removeItem(product.id);
                                              return;
                                            }

                                            if (items.length >= 4) {
                                              setError(
                                                "You can compare a maximum of four products."
                                              );
                                              return;
                                            }

                                            addItem({
                                              id: product.id,
                                              title: product.title,
                                              slug: product.slug,
                                              price: product.price ?? 0,
                                              imageUrl: product.imageUrl ?? null,
                                            });

                                            setError("");
                                          }}
                                          className={`mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-bold ${
                                            selected
                                              ? "bg-green-50 text-green-700"
                                              : "bg-slate-900 text-white hover:bg-orange-500"
                                          }`}
                                        >
                                          {selected
                                            ? "✓ Added to compare"
                                            : "+ Add to compare"}
                                        </button>
                                      </article>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {suggestedCategories.length > 0 && (
                              <div>
                                <h4 className="mb-3 text-sm font-bold text-slate-800">
                                  Explore related categories
                                </h4>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {suggestedCategories.map((category) => (
                                    <Link
                                      key={category.slug}
                                      href={`/products?category=${encodeURIComponent(
                                        category.slug
                                      )}`}
                                      className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-sm"
                                    >
                                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                                        <ChevronRight size={20} />
                                      </div>

                                      <h5 className="text-sm font-bold">
                                        {category.name}
                                      </h5>

                                      <p className="mt-1 text-xs text-slate-500">
                                        {category.productCount} available
                                        products
                                      </p>

                                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                                        Explore category
                                        <ChevronRight size={13} />
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {suggestedProducts.length > 0 && (
                              <div>
                                <h4 className="mb-3 text-sm font-bold text-slate-800">
                                  More products you might like
                                </h4>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {suggestedProducts.map((product) => (
                                    <article
                                      key={product.id}
                                      className="rounded-2xl border border-slate-200 bg-white p-3"
                                    >
                                      <p className="text-[10px] font-semibold uppercase text-orange-500">
                                        {product.categoryName}
                                      </p>

                                      <h5 className="mt-2 line-clamp-2 text-xs font-bold">
                                        {product.title}
                                      </h5>

                                      <p className="mt-2 text-sm font-extrabold text-orange-600">
                                        {money(product.price)}
                                      </p>

                                      <button
                                        onClick={() =>
                                          addSuggestedProduct(product)
                                        }
                                        disabled={
                                          items.some(
                                            (item) => item.id === product.id
                                          ) || items.length >= 4
                                        }
                                        className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-orange-500 disabled:opacity-40"
                                      >
                                        Add to compare
                                      </button>
                                    </article>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  ))}

                  {isSending && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                        <BrainCircuit size={17} />
                      </div>

                      <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                        Thinking about your question...
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </section>
            )}

            {isLoading && !isComparing && (
              <div className="mt-10 flex flex-col items-center justify-center text-center">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
                <p className="text-sm font-semibold">
                  Finding and comparing products
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Checking available product information...
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Persistent comparison tray */}
      {items.length > 0 && (
        <div className="fixed bottom-[85px] left-3 right-3 z-30 mx-auto max-w-4xl rounded-2xl border border-orange-200 bg-white p-3 shadow-xl sm:bottom-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">
                {items.length}/4 products selected
              </p>
              <p className="text-[11px] text-slate-500">
                {items.length < 2
                  ? "Select at least two products to compare."
                  : "Add more products or ask iBUY AI a question."}
              </p>
            </div>

            <button
              onClick={openCatalogue}
              disabled={items.length >= 4}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
              Add products
            </button>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl bg-slate-100 p-2"
              >
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-lg bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                    <BrainCircuit size={17} className="text-slate-400" />
                  </div>
                )}

                <span className="max-w-28 truncate text-xs font-medium">
                  {item.title}
                </span>

                <button
                  onClick={() => handleRemoveProduct(item.id)}
                  aria-label={`Remove ${item.title}`}
                  className="text-red-500"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalogue modal */}
      {showCatalogue && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowCatalogue(false);
            }
          }}
        >
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Search size={18} />
                  </div>

                  <div>
                    <h2 className="font-bold">Add products</h2>
                    <p className="text-xs text-slate-500">
                      Select products from the iBUY catalogue.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowCatalogue(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close catalogue"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-orange-400 focus-within:bg-white">
                <Search size={17} className="shrink-0 text-slate-400" />

                <input
                  type="search"
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  placeholder="Search products by name..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  autoFocus
                />

                {catalogueSearch && (
                  <button
                    onClick={() => setCatalogueSearch("")}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {items.length}/4 products selected
                </p>

                <p className="text-[11px] text-slate-400">
                  {items.length >= 4
                    ? "Maximum reached"
                    : `${4 - items.length} more can be added`}
                </p>
              </div>
            </div>

            {/* Catalogue results */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {catalogueLoading && catalogueProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    Loading products...
                  </p>
                </div>
              ) : catalogueError && catalogueProducts.length === 0 ? (
                <div className="rounded-xl bg-red-50 p-5 text-center">
                  <p className="text-sm text-red-600">{catalogueError}</p>
                  <button
                    onClick={() =>
                      fetchCatalogue(1, catalogueSearch.trim())
                    }
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : catalogueProducts.length === 0 ? (
                <div className="py-16 text-center">
                  <Search
                    size={30}
                    className="mx-auto text-slate-300"
                  />
                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    No products found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try another product name or search term.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {catalogueProducts.map((product) => {
                      const selected = items.some(
                        (item) => item.id === product.id
                      );

                      const disabled = !selected && items.length >= 4;

                      return (
                        <article
                          key={product.id}
                          className={`overflow-hidden rounded-2xl border bg-white p-2.5 transition ${
                            selected
                              ? "border-green-300 ring-1 ring-green-100"
                              : "border-slate-200 hover:border-orange-300"
                          }`}
                        >
                          <Link href={`/products/${product.slug}`}>
                            <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-50">
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.title}
                                  fill
                                  sizes="(max-width: 640px) 45vw, 200px"
                                  className="object-contain p-2"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <BrainCircuit
                                    size={28}
                                    className="text-slate-300"
                                  />
                                </div>
                              )}
                            </div>

                            <h3 className="mt-3 line-clamp-2 min-h-10 text-xs font-bold leading-5 text-slate-800">
                              {product.title}
                            </h3>
                          </Link>

                          <p className="mt-2 text-sm font-extrabold text-orange-600">
                            {money(product.price)}
                          </p>

                          {product.sellerName && (
                            <p className="mt-1 truncate text-[10px] text-slate-400">
                              {product.sellerName}
                            </p>
                          )}

                          <button
                            onClick={() => {
                              if (selected) {
                                removeItem(product.id);
                                setCatalogueError("");
                              } else {
                                addCatalogueProduct(product);
                              }
                            }}
                            disabled={disabled}
                            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              selected
                                ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600"
                                : "bg-slate-900 text-white hover:bg-orange-500"
                            }`}
                          >
                            {selected ? (
                              <>
                                <Check size={14} />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                Add to compare
                              </>
                            )}
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  {catalogueError && (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                      {catalogueError}
                    </p>
                  )}

                  {catalogueHasMore && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() =>
                          fetchCatalogue(
                            cataloguePage + 1,
                            catalogueSearch.trim(),
                            true
                          )
                        }
                        disabled={catalogueLoading}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:border-orange-300 hover:text-orange-600 disabled:opacity-50"
                      >
                        {catalogueLoading
                          ? "Loading..."
                          : "Load more products"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {items.length} products selected
                </p>
                <p className="text-[10px] text-slate-400">
                  You can compare up to four products.
                </p>
              </div>

              <button
                onClick={() => setShowCatalogue(false)}
                className="rounded-xl bg-orange-500 px-5 py-3 text-xs font-bold text-white hover:bg-orange-600"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Fixed chat composer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-4xl">
          <form
  onSubmit={sendMessage}
  className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100"
>
  <button
    type="button"
    onClick={openCatalogue}
    disabled={items.length >= 4}
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-orange-100 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
    aria-label="Add products to compare"
    title="Add products"
  >
    <Plus size={22} />
  </button>

  <textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !isSending &&
        !isLoading
      ) {
        e.preventDefault();

        if (input.trim()) {
          e.currentTarget.form?.requestSubmit();
        }
      }
    }}
    placeholder={
      isComparing
        ? "Ask a follow-up about these products..."
        : "What would you like to compare or find?"
    }
    rows={1}
    maxLength={1000}
    className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400"
  />

  <button
    type="submit"
    disabled={
      (!input.trim() && items.length === 0) ||
      isSending ||
      isLoading
    }
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
    aria-label="Send message"
  >
    {isSending || isLoading ? (
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    ) : (
      <ArrowUp size={21} />
    )}
  </button>
</form>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[10px] text-slate-400">
              iBUY AI can make mistakes. Verify important product details.
            </p>

            <p className="hidden text-[10px] text-slate-400 sm:block">
              Enter to send · Shift + Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}