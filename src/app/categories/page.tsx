 "use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  ChevronRight,
  Star,
  Tag,
  Package,
  RefreshCw,
} from "lucide-react";

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  children: Subcategory[];
}

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number;
  imageUrl: string | null;
  sellerName: string | null;
  rating: number;
  reviewCount: number;
  stockQuantity: number;
  inStock: boolean;
}

function formatPrice(price: number) {
  return `GH₵ ${price.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="aspect-square animate-pulse bg-gray-100" />
      <div className="space-y-3 p-3">
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [categoryError, setCategoryError] = useState("");
  const [productError, setProductError] = useState("");

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId
  );


const fetchCategories = useCallback(async () => {
  setIsLoading(true);
  setCategoryError("");

  try {
    const response = await fetch(
      "/api/categories?include=subcategories",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Unable to load categories.");
    }

    const data = await response.json();

    const parentCategories: Category[] = (data.categories || [])
      .filter((category: any) => !category.parentId)
      .map((category: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl || null,
        parentId: null,
        children: (category.children || []).map((child: any) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          imageUrl: child.iconUrl || null,
        })),
      }));

    setCategories(parentCategories);

    setSelectedCategoryId((current) =>
      current && parentCategories.some((category) => category.id === current)
        ? current
        : parentCategories[0]?.id || ""
    );
  } catch (error) {
    console.error("Categories fetch error:", error);
    setCategoryError("We couldn't load categories. Please try again.");
  } finally {
    setIsLoading(false);
  }
}, []);

useEffect(() => {
  fetchCategories();
}, [fetchCategories]);
 
  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts([]);
      return;
    }

    const controller = new AbortController();

    async function fetchProducts() {
      setIsLoadingProducts(true);
      setProductError("");
      setProducts([]);

      try {
        const params = new URLSearchParams({
          categoryId: selectedCategoryId,
          page: "1",
          limit: "8",
          sort: "rating",
        });

        const response = await fetch(
          `/api/products?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        const data = await response.json();

        setProducts(data.products || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Category products error:", error);
        setProductError("We couldn't load products. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingProducts(false);
        }
      }
    }

    fetchProducts();

    return () => controller.abort();
  }, [selectedCategoryId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 py-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-gray-100"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (categoryError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
        <Package className="mb-4 h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">
          Categories unavailable
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {categoryError}
        </p>
        <button
          onClick={fetchCategories}
          className="mt-5 flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">

      {/* Page heading */}
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <Tag className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Shop by Category
          </h1>
        </div>

        <p className="text-sm text-gray-500">
          Explore products from different categories across Ghana.
        </p>
      </section>

      
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <aside className="hidden w-60 shrink-0 rounded-xl border border-gray-200 bg-white p-3 md:block">
  <h2 className="mb-3 px-2 text-sm font-bold text-gray-900">
    All Categories
  </h2>

  <nav className="space-y-1">
    {categories.map((category) => (
      <button
        key={category.id}
        onClick={() => setSelectedCategoryId(category.id)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
          category.id === selectedCategoryId
            ? "bg-orange-50 font-semibold text-orange-700"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <span>{category.name}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    ))}
  </nav>
</aside>
         
        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-6">

          {/* Mobile category navigation */}
<section className="space-y-3 md:hidden">
  <h2 className="text-sm font-bold text-gray-900">
    Browse Categories
  </h2>

  <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
    {categories.map((category) => {
      const active = category.id === selectedCategoryId;

      return (
        <button
          key={category.id}
          onClick={() => setSelectedCategoryId(category.id)}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition ${
            active
              ? "border-orange-500 bg-orange-500 text-white"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          {category.name}
        </button>
      );
    })}
  </div>
</section>

          {categories.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                No matching categories found.
              </p>
            </div>
          ) : selectedCategory ? (
            <>
              {/* Selected category heading */}
              <section className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Exploring
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-gray-900">
                    {selectedCategory.name}
                  </h2>
                </div>

                <Link
                  href={`/products?categoryId=${selectedCategory.id}`}
                  className="flex items-center gap-1 text-xs font-semibold text-orange-600 sm:text-sm"
                >
                  All Products
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </section>

              {/* Subcategories */}
              {selectedCategory.children.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">
                      Explore Subcategories
                    </h3>

                    <span className="text-xs text-gray-400">
                      {selectedCategory.children.length} categories
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {selectedCategory.children.map((subcategory) => (
                      <Link
                        key={subcategory.id}
                        href={`/categories/${subcategory.slug}`}
                        className="group rounded-xl border border-gray-100 bg-white p-2 text-center transition hover:border-orange-300 hover:shadow-sm"
                      >
                        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-gray-50">
                          {subcategory.imageUrl ? (
                            <Image
                              src={subcategory.imageUrl}
                              alt={subcategory.name}
                              fill
                              sizes="(max-width: 640px) 30vw, 150px"
                              className="object-contain p-3 transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Tag className="h-8 w-8 text-gray-300" />
                            </div>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-2 text-xs font-medium text-gray-700 group-hover:text-orange-600">
                          {subcategory.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Products */}
              <section className="space-y-4">

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      Popular Products
                    </h3>

                    <p className="mt-0.5 text-xs text-gray-500">
                      Discover products in {selectedCategory.name}
                    </p>
                  </div>

                  <Link
                    href={`/products?categoryId=${selectedCategory.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-orange-600"
                  >
                    See All
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <ProductSkeleton key={index} />
                    ))}
                  </div>
                ) : productError ? (
                  <div className="rounded-xl border border-gray-200 bg-white py-10 text-center">
                    <p className="text-sm text-gray-500">
                      {productError}
                    </p>

                    <button
                      onClick={() => {
                        setSelectedCategoryId("");
                        setTimeout(
                          () => setSelectedCategoryId(selectedCategory.id),
                          0
                        );
                      }}
                      className="mt-3 text-sm font-semibold text-orange-600"
                    >
                      Try again
                    </button>
                  </div>
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

                    {products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-orange-300 hover:shadow-md"
                      >
                        {/* Product image */}
                        <div className="relative aspect-square overflow-hidden bg-gray-50">

                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.title}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-10 w-10 text-gray-300" />
                            </div>
                          )}

                          {product.discountPercent > 0 && (
                            <span className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-1 text-[10px] font-bold text-white">
                              -{product.discountPercent}%
                            </span>
                          )}

                          {!product.inStock && (
                            <span className="absolute bottom-2 left-2 rounded bg-gray-900/80 px-2 py-1 text-[10px] font-semibold text-white">
                              Unavailable
                            </span>
                          )}
                        </div>

                        {/* Product information */}
                        <div className="space-y-2 p-3">

                          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            {product.sellerName || "iBUY Marketplace"}
                          </p>

                          <h4 className="line-clamp-2 min-h-9 text-xs font-medium leading-5 text-gray-800 sm:text-sm">
                            {product.title}
                          </h4>

                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />

                            <span className="text-xs font-semibold text-gray-700">
                              {Number(product.rating || 0).toFixed(1)}
                            </span>

                            <span className="text-[10px] text-gray-400">
                              ({product.reviewCount || 0})
                            </span>
                          </div>

                          <div className="border-t border-gray-100 pt-2">
                            {product.price !== null ? (
                              <>
                                <p className="text-sm font-bold text-orange-600 sm:text-base">
                                  {formatPrice(Number(product.price))}
                                </p>

                                {product.originalPrice &&
                                  product.originalPrice > product.price && (
                                    <p className="text-[10px] text-gray-400 line-through">
                                      {formatPrice(
                                        Number(product.originalPrice)
                                      )}
                                    </p>
                                  )}
                              </>
                            ) : (
                              <p className="text-xs font-medium text-gray-500">
                                Price unavailable
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                    <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />

                    <h4 className="font-semibold text-gray-800">
                      No products yet
                    </h4>

                    <p className="mt-1 text-sm text-gray-500">
                      Products in this category will appear here.
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}