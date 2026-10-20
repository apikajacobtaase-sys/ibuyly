 // src/app/seller/stocking/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Package, AlertTriangle, Plus, X, Loader2, Check } from "lucide-react";

interface Variant {
  id: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  attributes: any;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  category: { name: string };
  variants: Variant[];
  images: { url: string }[];
}

interface Offer {
  id: string;
  price: number;
  stockQuantity: number;
  condition: string;
  sellerSku: string | null;
  variant: {
    sku: string | null;
    product: {
      title: string;
      slug: string;
      images: { url: string }[];
    };
  };
}

export default function StockingPage() {
  const [activeTab, setActiveTab] = useState<"find" | "mystock">("find");
  
  // Search State
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // My Stock State
  const [myStock, setMyStock] = useState<Offer[]>([]);
  const [stockFilter, setStockFilter] = useState<"all" | "low_stock" | "out_of_stock">("all");
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formCondition, setFormCondition] = useState("NEW");
  const [formSku, setFormSku] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const fetchSearch = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/seller/catalogue-search?q=${encodeURIComponent(debouncedQuery)}`);
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchSearch();
  }, [debouncedQuery]);

  // Fetch My Stock
  useEffect(() => {
    if (activeTab === "mystock") {
      const fetchStock = async () => {
        setIsLoadingStock(true);
        try {
          const res = await fetch(`/api/seller/offers?filter=${stockFilter}`);
          const data = await res.json();
          setMyStock(data.offers || []);
        } catch (err) {
          console.error("Fetch stock failed", err);
        } finally {
          setIsLoadingStock(false);
        }
      };
      fetchStock();
    }
  }, [activeTab, stockFilter]);

  const openAddModal = (product: Product, variant: Variant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setFormPrice(variant.price.toString());
    setFormStock("0");
    setFormCondition("NEW");
    setFormSku(variant.sku || "");
    setError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/seller/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          price: parseFloat(formPrice),
          stockQuantity: parseInt(formStock, 10),
          condition: formCondition,
          sellerSku: formSku || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setQuery(""); // Clear search after success
        setActiveTab("mystock"); // Switch to My Stock to see it
      } else {
        setError(data.error || "Failed to add to stock");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Stock Your Store</h1>
          <p className="text-sm text-gray-500">Find products in the iBUY catalogue and add them to your inventory.</p>
        </div>
        
        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-6 border-t border-gray-100">
          <button
            onClick={() => setActiveTab("find")}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "find" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Find Products
          </button>
          <button
            onClick={() => setActiveTab("mystock")}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "mystock" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            My Stock
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ================= FIND PRODUCTS TAB ================= */}
        {activeTab === "find" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by product name, brand, model, or SKU..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
              />
            </div>

            {/* Results */}
            {isSearching && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
            )}

            {!isSearching && debouncedQuery.length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900">No exact matches found</h3>
                <p className="text-xs text-gray-500 mt-1">Try adjusting your search terms or check for typos.</p>
              </div>
            )}

            <div className="space-y-3">
              {searchResults.map((product) => (
                <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-3 flex gap-4 shadow-sm">
                  <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    {product.images[0]?.url ? (
                      <img src={product.images[0].url} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="w-6 h-6" /></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{product.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{product.category.name}</p>
                    
                    <div className="mt-2 space-y-2">
                      {product.variants.slice(0, 2).map((variant) => (
                        <div key={variant.id} className="flex items-center justify-between bg-gray-50 rounded-md p-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">
                              {variant.sku || "No SKU"} 
                              {variant.attributes && typeof variant.attributes === 'object' && Object.values(variant.attributes)[0] && ` • ${Object.values(variant.attributes)[0]}`}
                            </p>
                            <p className="text-xs text-green-700 font-semibold">Catalogue Base: GH₵ {Number(variant.price).toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => openAddModal(product, variant)}
                            className="flex-shrink-0 ml-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      ))}
                      {product.variants.length > 2 && (
                        <p className="text-xs text-gray-400 text-center">+ {product.variants.length - 2} more variants</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= MY STOCK TAB ================= */}
        {activeTab === "mystock" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(["all", "low_stock", "out_of_stock"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStockFilter(filter)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    stockFilter === filter
                      ? "bg-green-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {filter === "all" ? "All Stock" : filter === "low_stock" ? "Low Stock (≤10)" : "Out of Stock"}
                </button>
              ))}
            </div>

            {isLoadingStock ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-green-600 animate-spin" /></div>
            ) : myStock.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900">No stock found</h3>
                <p className="text-xs text-gray-500 mt-1">Switch to "Find Products" to add items to your inventory.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {myStock.map((offer) => (
                  <div key={offer.id} className="p-4 border-b border-gray-100 last:border-0 flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {offer.variant.product.images[0]?.url ? (
                        <img src={offer.variant.product.images[0].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{offer.variant.product.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>SKU: {offer.sellerSku || offer.variant.sku || "N/A"}</span>
                        <span className={offer.stockQuantity <= 10 ? "text-orange-600 font-semibold" : ""}>
                          Stock: {offer.stockQuantity}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">GH₵ {Number(offer.price).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 capitalize">{offer.condition.toLowerCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= ADD TO STOCK MODAL ================= */}
      {isModalOpen && selectedProduct && selectedVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Add to My Stock</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Product Summary */}
              <div className="flex gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                <div className="w-12 h-12 bg-white rounded-md overflow-hidden flex-shrink-0">
                  {selectedProduct.images[0]?.url ? (
                    <img src={selectedProduct.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="w-5 h-5"/></div>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedProduct.title}</p>
                  <p className="text-xs text-gray-500">{selectedVariant.sku || "No SKU"}</p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Your Selling Price (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Stock *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Condition</label>
                    <select
                      value={formCondition}
                      onChange={(e) => setFormCondition(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                    > 
                     <option value="NEW">New</option>
                     <option value="USED">Used</option>
                     <option value="REFURBISHED">Refurbished</option>
                 </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Your Internal SKU (Optional)</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="e.g., MY-STORE-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isSubmitting ? "Adding..." : "Add to Stock"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}