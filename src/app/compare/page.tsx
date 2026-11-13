"use client";

import { useEffect, useState } from "react";
import { useCompareStore } from "@/store/compareStore";
import Link from "next/link";
import Image from "next/image";
import {
  X,
  Star,
  ShieldCheck,
  BrainCircuit,
  Trophy,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
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

export default function ComparePage() {
  const { items, removeItem, clearCompare } = useCompareStore();
const [products, setProducts] = useState<ProductData[]>([]);
const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null);
const [analysisError, setAnalysisError] = useState("");
const [isLoading, setIsLoading] = useState(true);
const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      fetchComparisonData();
    } else {
      setIsLoading(false);
    }
  }, [items]);

const fetchComparisonData = async () => {
  setIsLoading(true);
  setIsAnalyzing(false);
  setAnalysis(null);
  setAnalysisError("");

  try {
    // First: fetch products without waiting for Gemini.
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: items.map((i) => i.id),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch comparison data.");
    }

    setProducts(data.products || []);
    setIsLoading(false);

    // Second: generate AI analysis independently.
    setIsAnalyzing(true);

    const analysisRes = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: items.map((i) => i.id),
        includeAnalysis: true,
      }),
    });

    const analysisData = await analysisRes.json();

    if (!analysisRes.ok) {
      throw new Error(
        analysisData.error || "Failed to generate AI analysis."
      );
    }

    setAnalysis(analysisData.analysis || null);
    setAnalysisError(
      typeof analysisData.analysisError === "string"
        ? analysisData.analysisError
        : ""
    );
  } catch (error) {
    console.error("Comparison error:", error);

    setAnalysisError(
      error instanceof Error
        ? error.message
        : "Unable to complete product comparison."
    );
  } finally {
    setIsLoading(false);
    setIsAnalyzing(false);
  }
};
  if (isLoading) {
    return (
      <div className="min-h-screen bg-ibuy-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ibuy-orange"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
        <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/" className="text-ibuy-orange hover:underline">← Back</Link>
            <h1 className="text-xl font-bold text-ibuy-text">Compare Products</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-ibuy-text mb-2">No products to compare</h2>
          <p className="text-ibuy-text-secondary mb-6">Add products to compare by clicking the purple compare icon on product cards</p>
          <Link href="/" className="inline-block bg-ibuy-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-ibuy-orange-hover transition">
            Browse Products
          </Link>
        </div>
        
      </div>
    );
  }

   const allAttributeKeys = new Set<string>();

  products.forEach((product) => {
    if (product.attributes && typeof product.attributes === "object") {
      Object.keys(product.attributes).forEach((key) => {
        allAttributeKeys.add(key);
      });
    }
  });

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return (
        <span className="text-gray-400 italic text-xs">
          Not provided
        </span>
      );
    }

    if (typeof value === "boolean") {
      return value ? (
        <span className="text-green-600 text-xs">✓ Yes</span>
      ) : (
        <span className="text-red-600 text-xs">✗ No</span>
      );
    }

    if (Array.isArray(value)) {
      return (
        <span className="text-xs">
          {value.map(String).join(", ")}
        </span>
      );
    }

    if (typeof value === "object") {
      return (
        <span className="text-xs">
          {Object.entries(value)
            .map(([key, item]) => `${key}: ${String(item)}`)
            .join(" · ")}
        </span>
      );
    }

    return <span className="text-xs">{String(value)}</span>;
  };

  const isDifferent = (values: unknown[]) => {
    const normalizedValues = values.map((value) =>
      value === null || value === undefined || value === ""
        ? null
        : JSON.stringify(value)
    );

    return new Set(normalizedValues).size > 1;
  };

  return (
    <div className="min-h-screen bg-ibuy-bg pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-ibuy-card border-b border-ibuy-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-ibuy-orange hover:underline text-sm">← Back</Link>
            <h1 className="text-lg font-bold text-ibuy-text">Compare Products</h1>
          </div>
          <button
            onClick={clearCompare}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 md:px-4 py-4">
        {/* Product Headers - Compact */}
        <div className="bg-ibuy-card rounded-lg border border-ibuy-border overflow-hidden mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
            {products.map((product) => (
              <div key={product.id} className="relative p-3 border-r border-ibuy-border last:border-r-0">
                <button
  type="button"
  onClick={() => removeItem(product.id)}
  aria-label={`Remove ${product.title} from comparison`}
  title="Remove product"
                  className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <Link href={`/products/${product.slug}`}>
                  <div className="relative aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📦</div>
                    )}
                  </div>
                  <h3 className="font-semibold text-ibuy-text text-xs line-clamp-2 mb-1 hover:text-ibuy-orange transition">
                    {product.title}
                  </h3>
                </Link>
                <div className="space-y-1">
  {product.price !== null ? (
    <>
      <p className="text-sm font-bold text-ibuy-orange">
        GH₵ {product.price.toFixed(2)}
      </p>

      {product.compareAtPrice !== null &&
        product.compareAtPrice > product.price && (
          <p className="text-[10px] text-gray-400 line-through">
            GH₵ {product.compareAtPrice.toFixed(2)}
          </p>
        )}
    </>
  ) : (
    <p className="text-xs font-medium text-gray-500">
      No active offer
    </p>
  )}

  <p className={`text-[10px] font-medium ${
    product.stockQuantity > 10
      ? "text-green-600"
      : product.stockQuantity > 0
        ? "text-orange-600"
        : "text-red-600"
  }`}>
    {product.stockQuantity > 10
      ? `${product.stockQuantity} in stock`
      : product.stockQuantity > 0
        ? `Only ${product.stockQuantity} left`
        : "Out of stock"}
  </p>
</div>
              </div>
            ))}
          </div>
        </div>
                  {/* AI Shopping Intelligence */}
        <section className="mb-4 rounded-xl border border-ibuy-intelligence/30 bg-ibuy-card overflow-hidden">
          <div className="bg-ibuy-intelligence/10 px-4 py-3 border-b border-ibuy-border">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-ibuy-intelligence" />
              <div>
                <h2 className="font-bold text-sm text-ibuy-text">
                  iBUY AI Shopping Intelligence
                </h2>
                <p className="text-[10px] text-ibuy-text-secondary">
                  Intelligent analysis powered by Gemini
                </p>
              </div>
              <Sparkles className="w-4 h-4 text-ibuy-intelligence ml-auto" />
            </div>
          </div>

          <div className="p-4 space-y-4">
            {analysisError ? (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{analysisError}</p>
              </div>
            ) : analysis ? (
              <>
                <div>
                  <h3 className="font-bold text-sm text-ibuy-text mb-2">
                    Overall Analysis
                  </h3>
                  <p className="text-sm text-ibuy-text-secondary leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: "Best Overall",
                      id: analysis.bestOverallProductId,
                      icon: Trophy,
                      color: "text-ibuy-orange",
                    },
                    {
                      label: "Best Value",
                      id: analysis.bestValueProductId,
                      icon: CheckCircle2,
                      color: "text-green-600",
                    },
                  ].map((winner) => {
                    const product = products.find(
                      (item) => item.id === winner.id
                    );
                    const Icon = winner.icon;

                    return (
                      <div
                        key={winner.label}
                        className="rounded-lg border border-ibuy-border p-3"
                      >
                        <div className={`flex items-center gap-2 mb-2 ${winner.color}`}>
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-bold">
                            {winner.label}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-ibuy-text">
                          {product?.title ?? "No clear winner"}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-ibuy-text mb-3">
                    Individual Product Analysis
                  </h3>

                  <div className="space-y-3">
                    {analysis.productAnalyses.map((item) => {
                      const product = products.find(
                        (p) => p.id === item.productId
                      );

                      if (!product) return null;

                      return (
                        <div
                          key={item.productId}
                          className="rounded-lg border border-ibuy-border p-3"
                        >
                          <h4 className="font-semibold text-sm text-ibuy-text mb-2">
                            {product.title}
                          </h4>

                          {item.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-green-600 mb-1">
                                Strengths
                              </p>
                              <ul className="space-y-1">
                                {item.strengths.map((strength, index) => (
                                  <li
                                    key={index}
                                    className="text-xs text-ibuy-text-secondary flex gap-2"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                                    {strength}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.weaknesses.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-red-600 mb-1">
                                Weaknesses
                              </p>
                              <ul className="space-y-1">
                                {item.weaknesses.map((weakness, index) => (
                                  <li
                                    key={index}
                                    className="text-xs text-ibuy-text-secondary flex gap-2"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                                    {weakness}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="border-t border-ibuy-border pt-2 mt-2">
                            <p className="text-xs text-ibuy-text-secondary leading-relaxed">
                              <strong className="text-ibuy-text">
                                AI Verdict:{" "}
                              </strong>
                              {item.verdict || "No verdict available."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg bg-ibuy-intelligence/5 p-3">
                  <h3 className="font-bold text-sm text-ibuy-text mb-2">
                    Buying Recommendation
                  </h3>
                  <p className="text-sm text-ibuy-text-secondary leading-relaxed">
                    {analysis.buyingRecommendation}
                  </p>
                </div>

                {analysis.caveats.length > 0 && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                    <h3 className="font-bold text-xs text-yellow-800 mb-2">
                      Important Considerations
                    </h3>
                    <ul className="space-y-1">
                      {analysis.caveats.map((caveat, index) => (
                        <li
                          key={index}
                          className="text-xs text-yellow-900 flex gap-2"
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          {caveat}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : isAnalyzing ? (
  <div className="flex items-center gap-3 py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-ibuy-intelligence border-t-transparent" />

    <div>
      <p className="text-sm font-semibold text-ibuy-text">
        Gemini is analyzing your products...
      </p>
      <p className="text-xs text-ibuy-text-secondary">
        Evaluating specifications, prices, seller trust and value for money.
      </p>
    </div>
  </div>
) : (
  <p className="text-sm text-ibuy-text-secondary">
    AI analysis is not available yet.
  </p>
)}
          </div>
        </section>

        {/* Comparison Table - Compact */}
        <div className="bg-ibuy-card rounded-lg border border-ibuy-border overflow-hidden">
          {/* Basic Info Section */}
          <div className="border-b-2 border-ibuy-border">
            <div className="bg-ibuy-intelligence/10 px-3 py-1.5 border-b border-ibuy-border">
              <h3 className="font-bold text-ibuy-intelligence text-xs">Basic Information</h3>
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-[10px] text-gray-500 mb-0.5">Category</p>
                  <p className="text-xs text-ibuy-text">{product.categoryName}</p>
                </div>
              ))}
            </div>

            {/* Rating */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-[10px] text-gray-500 mb-0.5">Rating</p>
                  {product.avgRating !== null && product.reviewCount > 0 ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium text-ibuy-text">{product.avgRating}</span>
                      <span className="text-[10px] text-gray-500">({product.reviewCount})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No reviews</span>
                  )}
                </div>
              ))}
            </div>

            {/* Seller Comparison */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-0">
  {products.map((product) => (
    <div
      key={product.id}
      className="px-3 py-3 border-r border-ibuy-border last:border-r-0 space-y-2"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Seller
      </p>

      {product.sellerId ? (
        <>
          <div className="flex items-center gap-2 min-w-0">
            {product.sellerLogoUrl ? (
              <Image
                src={product.sellerLogoUrl}
                alt={product.sellerName ?? "Seller"}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover border border-ibuy-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                {(product.sellerName ?? "S").charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-semibold text-ibuy-text truncate">
                {product.sellerName ?? "Unknown seller"}
              </p>

              {product.sellerVerified && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-ibuy-intelligence">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 border-t border-ibuy-border pt-2">
            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-gray-500">Trust score</span>
              <span className="font-semibold text-ibuy-text">
                {product.sellerTrustScore !== null
                  ? `${product.sellerTrustScore}/100`
                  : "Not rated"}
              </span>
            </div>

            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-gray-500">Seller rating</span>
              <span className="font-semibold text-ibuy-text">
                {product.sellerRating !== null
                  ? `★ ${product.sellerRating.toFixed(1)}`
                  : "No rating"}
              </span>
            </div>

            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-gray-500">Fulfillment</span>
              <span className="font-semibold text-ibuy-text">
                {product.sellerFulfillmentRate !== null
                  ? `${product.sellerFulfillmentRate.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-gray-500">Return rate</span>
              <span className="font-semibold text-ibuy-text">
                {product.sellerReturnRate !== null
                  ? `${product.sellerReturnRate.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between gap-2 text-[10px]">
              <span className="text-gray-500">Total orders</span>
              <span className="font-semibold text-ibuy-text">
                {product.sellerTotalOrders.toLocaleString()}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-500 py-2">
          No available seller
        </p>
      )}
    </div>
  ))}
</div>
          </div>

          {/* Attributes Section */}
          {allAttributeKeys.size > 0 && (
            <div className="border-b-2 border-ibuy-border">
              <div className="bg-ibuy-orange/10 px-3 py-1.5 border-b border-ibuy-border">
                <h3 className="font-bold text-ibuy-orange text-xs">Specifications</h3>
              </div>
              {Array.from(allAttributeKeys).map((key) => {
                const values = products.map((p) => p.attributes?.[key]);
                const different = isDifferent(values);

                return (
                  <div key={key} className={`grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-ibuy-border ${different ? "bg-yellow-50" : ""}`}>
                    {products.map((product, idx) => (
                      <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                        <p className="text-[10px] text-gray-500 mb-0.5 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                          {different && idx === 0 && <span className="ml-1 text-ibuy-orange">⚡</span>}
                        </p>
                        {renderValue(product.attributes?.[key])}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Description Section */}
          <div>
            <div className="bg-gray-100 px-3 py-1.5 border-b border-ibuy-border">
              <h3 className="font-bold text-ibuy-text text-xs">Description</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              {products.map((product) => (
                <div key={product.id} className="px-3 py-2 border-r border-ibuy-border last:border-r-0">
                  <p className="text-xs text-ibuy-text line-clamp-3">{product.description || "No description"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-ibuy-card rounded-lg border border-ibuy-border p-3">
          <h4 className="font-semibold text-ibuy-text text-xs mb-2">Legend</h4>
          <div className="flex flex-wrap gap-3 text-[10px] text-ibuy-text-secondary">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-50 border border-yellow-200 rounded"></div>
              <span>Differences</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-ibuy-orange">⚡</span>
              <span>Key difference</span>
            </div>
            <div className="flex items-center gap-1">
             <ShieldCheck
  className="w-3 h-3 text-ibuy-intelligence"
  aria-label="Verified Seller"
  role="img"
/>
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}