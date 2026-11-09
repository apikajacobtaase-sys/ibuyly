"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Package,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Store,
} from "lucide-react";

interface CatalogueVariant {
  id: string;
  sku: string | null;
  price: number | string;
  compareAtPrice: number | string | null;
  attributes: unknown;
}

interface CatalogueProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: { name: string } | null;
  variants: CatalogueVariant[];
  images: { url: string; altText?: string | null }[];
}

interface CatalogueResponse {
  products: CatalogueProduct[];
  total: number;
  page: number;
  totalPages: number;
}

function formatAttributes(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return "";
  }

  return Object.entries(attributes as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("  ");
}

export default function NewProductPage() {
  const router = useRouter();

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchError, setSearchError] = useState("");

  const [selectedProduct, setSelectedProduct] =
    useState<CatalogueProduct | null>(null);
  const [selectedVariant, setSelectedVariant] =
    useState<CatalogueVariant | null>(null);

  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [sellerSku, setSellerSku] = useState("");
  const [condition, setCondition] = useState("NEW");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setSearchError("");

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          page: "1",
          limit: "20",
        });

        const response = await fetch(
          `/api/seller/catalogue-search?${params.toString()}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load the catalogue.");
        }

        setProducts(data.products || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setSearchError(
          error instanceof Error
            ? error.message
            : "Unable to load the catalogue."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const chooseProduct = (product: CatalogueProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setPrice("");
    setStockQuantity("");
    setSellerSku("");
    setCondition("NEW");
    setSubmitError("");
  };

  const chooseVariant = (variant: CatalogueVariant) => {
    setSelectedVariant(variant);
    setPrice("");
    setStockQuantity("");
    setSellerSku("");
    setSubmitError("");
  };

  const returnToCatalogue = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSubmitError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedVariant) {
      setSubmitError("Select a product variant first.");
      return;
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stockQuantity);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setSubmitError("Enter a valid selling price greater than zero.");
      return;
    }

    if (
      !Number.isInteger(parsedStock) ||
      parsedStock < 0 ||
      stockQuantity.trim() === ""
    ) {
      setSubmitError("Enter a valid whole-number stock quantity.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          price: parsedPrice,
          stockQuantity: parsedStock,
          sellerSku: sellerSku.trim() || undefined,
          condition,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add this offer.");
      }

      router.push("/seller/products");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (value: number | string | null) => {
    if (value === null || value === undefined) return "Not specified";

    const amount = Number(value);

    if (!Number.isFinite(amount)) return "Not specified";

    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/seller/products"
            className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inventory
          </Link>

          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-teal-100 p-3 text-teal-700">
              <Store className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                Add an offer
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Choose an existing iBUY catalogue product and set your own
                selling price and stock.
              </p>
            </div>
          </div>
        </div>

        {!selectedProduct ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">
              Find a catalogue product
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Search by product name or description. Only approved products
              appear here.
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
                className="min-h-12 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                Searching catalogue...
              </div>
            ) : searchError ? (
              <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {searchError}
              </div>
            ) : products.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
                <Package className="mb-3 h-10 w-10 text-gray-300" />
                <h3 className="font-semibold text-gray-800">
                  No catalogue products found
                </h3>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  {query
                    ? "Try another search term."
                    : "The catalogue currently has no active products available for sellers."}
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => chooseProduct(product)}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {product.images?.[0]?.url ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].altText || product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {product.category?.name || "Uncategorized"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {product.variants.length} active{" "}
                        {product.variants.length === 1 ? "variant" : "variants"}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <button
                type="button"
                onClick={returnToCatalogue}
                className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-teal-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Choose another product
              </button>

              <div className="flex items-center gap-3">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {selectedProduct.images?.[0]?.url ? (
                    <img
                      src={selectedProduct.images[0].url}
                      alt={selectedProduct.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900">
                    {selectedProduct.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedProduct.category?.name || "Uncategorized"}
                  </p>
                  <p className="mt-1 text-xs text-teal-700">
                    Existing catalogue product
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="font-semibold text-gray-900">
                Select a variant
              </h2>
              <p className="mb-4 mt-1 text-sm text-gray-500">
                Choose the exact size, colour or configuration you intend to
                sell.
              </p>

              {selectedProduct.variants.length === 0 ? (
                <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  This catalogue product has no active variants available.
                  Please choose another product.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedProduct.variants.map((variant) => {
                    const attributes = formatAttributes(variant.attributes);
                    const isSelected = selectedVariant?.id === variant.id;

                    return (
                      <button
                        type="button"
                        key={variant.id}
                        onClick={() => chooseVariant(variant)}
                        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                            : "border-gray-200 hover:border-teal-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {attributes || variant.sku || "Standard variant"}
                          </p>
                          {variant.sku && attributes && (
                            <p className="mt-1 text-xs text-gray-500">
                              Catalogue SKU: {variant.sku}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Reference: {formatPrice(variant.price)}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-teal-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedVariant && (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
              >
                <h2 className="font-semibold text-gray-900">
                  Your selling offer
                </h2>
                <p className="mb-5 mt-1 text-sm text-gray-500">
                  These details belong to your shop. They will not change the
                  central catalogue product.
                </p>

                {submitError && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="offer-price"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Your selling price (GH) *
                    </label>
                    <input
                      id="offer-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="e.g. 250.00"
                      className="min-h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="offer-stock"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Available stock *
                    </label>
                    <input
                      id="offer-stock"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={stockQuantity}
                      onChange={(event) =>
                        setStockQuantity(event.target.value)
                      }
                      placeholder="e.g. 25"
                      className="min-h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="seller-sku"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Your SKU (optional)
                    </label>
                    <input
                      id="seller-sku"
                      type="text"
                      maxLength={100}
                      value={sellerSku}
                      onChange={(event) => setSellerSku(event.target.value)}
                      placeholder="Your internal product code"
                      className="min-h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="offer-condition"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Product condition
                    </label>
                    <select
                      id="offer-condition"
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="NEW">New</option>
                      <option value="LIKE_NEW">Like new</option>
                      <option value="USED_GOOD">Used - good</option>
                      <option value="USED_FAIR">Used - fair</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    disabled={isSubmitting}
                    className="min-h-12 rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Change variant
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding offer...
                      </>
                    ) : (
                      "Add to my inventory"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
