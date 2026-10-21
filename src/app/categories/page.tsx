// src/app/categories/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronRight, ArrowLeft, Star } from "lucide-react";

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  children: Subcategory[];
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for products
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories?include=subcategories");
        const data = await res.json();
        if (res.ok) {
          setCategories(data.categories || []);
          if (data.categories?.length > 0) {
            setSelectedCategoryId(data.categories[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch categories", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCategories();
  }, []);

  // Fetch products whenever the selected category changes
  useEffect(() => {
    if (!selectedCategoryId) return;
    
    async function fetchProducts() {
      setIsLoadingProducts(true);
      try {
        const res = await fetch(`/api/products?categoryId=${selectedCategoryId}&limit=8`);
        const data = await res.json();
        if (res.ok) {
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setIsLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [selectedCategoryId]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-0">
      {/* ==========================================
          TWO-COLUMN CATEGORY LAYOUT
      ========================================== */}
      <div className="flex max-w-7xl mx-auto">
        
        {/* LEFT COLUMN: Main Categories List */}
        <aside className="w-24 sm:w-28 bg-white border-r border-gray-200 overflow-y-auto h-[calc(100vh-60px)] sticky top-[60px] flex-shrink-0 scrollbar-hide">
          <nav className="py-2">
            {categories.map((category) => {
              const isActive = category.id === selectedCategoryId;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`w-full px-2 py-3.5 text-center border-b border-gray-100 transition-all relative ${
                    isActive 
                      ? "bg-white text-green-700 font-semibold" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-600" />
                  )}
                  <span className="text-xs sm:text-sm break-words leading-tight block">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT COLUMN: Category Content */}
        <main className="flex-1 p-3 sm:p-4 overflow-y-auto h-[calc(100vh-60px)] scrollbar-hide">
          {selectedCategory ? (
            <div className="space-y-4">
              
              {/* All Products Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between hover:border-green-300 transition-colors">
                <Link
                  href={`/products?categoryId=${selectedCategory.id}`}
                  className="flex-1 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">
                    All Products in {selectedCategory.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </div>

              {/* Subcategories Section */}
              {selectedCategory.children.length > 0 && (
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">
                      Subcategories
                    </h3>
                    {selectedCategory.children.length > 6 && (
                      <Link
                        href={`/products?categoryId=${selectedCategory.id}`}
                        className="text-sm font-semibold text-green-600 hover:text-green-700"
                      >
                        See All
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {selectedCategory.children.map((subcat) => (
                      <Link
                        key={subcat.id}
                        href={`/products?categoryId=${subcat.id}`}
                        className="text-center group"
                      >
                        <div className="aspect-square bg-gray-50 rounded-lg mb-2 overflow-hidden border border-gray-100 group-hover:border-green-300 transition-colors flex items-center justify-center">
                          {subcat.imageUrl ? (
                            <Image
                              src={subcat.imageUrl}
                              alt={subcat.name}
                              width={100}
                              height={100}
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded-full" />
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-gray-700 line-clamp-2 leading-tight group-hover:text-green-700 transition-colors h-8 flex items-center justify-center">
                          {subcat.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

                            {/* 👇 ENHANCED: Larger, Premium Product Cards */}
              <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">
                    Popular Products
                  </h3>
                  <Link
                    href={`/products?categoryId=${selectedCategory.id}`}
                    className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    See All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {isLoadingProducts ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
                  </div>
                ) : products.length > 0 ? (
                  // 👇 FIX: Reduced columns on large screens to make cards physically bigger
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {products.map((product: any) => {
                      const rating = product.rating || 0;
                      const reviewCount = product.reviewCount || 0;
                      const sellerName = product.seller?.businessName || "iBUY Marketplace";
                      const imageUrl = product.images?.[0]?.url || product.imageUrl || product.image || null;

                      return (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          className="group block bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-lg transition-all duration-300 overflow-hidden"
                        >
                          {/* Image - Larger and cleaner */}
                          <div className="aspect-square bg-gray-50 overflow-hidden relative">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={product.title}
                                width={300}
                                height={300}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-100">
                                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-medium">No Image</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Details - More padding and larger text */}
                          <div className="p-4">
                            {/* Seller Name */}
                            <p className="text-xs text-gray-500 mb-1.5 line-clamp-1 uppercase tracking-wide font-medium">
                              {sellerName}
                            </p>
                            
                            {/* Product Title - Bigger and bolder */}
                            <p className="text-sm sm:text-base text-gray-900 line-clamp-2 leading-snug h-12 group-hover:text-green-700 transition-colors font-medium">
                              {product.title}
                            </p>
                            
                            {/* Rating & Reviews - Larger stars */}
                            <div className="flex items-center gap-1.5 mt-3">
                              <div className="flex items-center text-yellow-400">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="text-sm font-bold text-gray-800 ml-1">
                                  {rating.toFixed(1)}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 font-medium">
                                ({reviewCount} reviews)
                              </span>
                            </div>

                            {/* Price & Sales - Prominent pricing */}
                            <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-100">
                              <p className="text-base sm:text-lg font-extrabold text-green-700">
                                GH₵ {parseFloat(product.price || 0).toFixed(2)}
                              </p>
                              {product.soldCount !== undefined && product.soldCount > 0 && (
                                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">
                                  {product.soldCount}+ sold
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-sm">
                      No products found in this category yet.
                    </p>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">Select a category to view products</p>
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}