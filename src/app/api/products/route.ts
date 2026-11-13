import { NextResponse } from "next/server";
import { discoverProducts, ProductSort } from "@/lib/product-discovery";

const VALID_SORTS: ProductSort[] = [
  "newest",
  "price_asc",
  "price_desc",
  "rating",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12)
    );

    const query =
      searchParams.get("q") ||
      searchParams.get("search") ||
      "";

    const categoryId = searchParams.get("categoryId") || undefined;

    const categorySlug =
      searchParams.get("categorySlug") ||
      searchParams.get("category") ||
      undefined;

    const minPriceParam = searchParams.get("minPrice");
    const maxPriceParam = searchParams.get("maxPrice");

    const minPrice =
      minPriceParam !== null ? Number(minPriceParam) : undefined;

    const maxPrice =
      maxPriceParam !== null ? Number(maxPriceParam) : undefined;

    if (
      (minPrice !== undefined &&
        (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined &&
        (!Number.isFinite(maxPrice) || maxPrice < 0))
    ) {
      return NextResponse.json(
        { error: "Invalid price filter" },
        { status: 400 }
      );
    }

    const requestedSort = searchParams.get("sort") as ProductSort | null;

    const sort: ProductSort =
      requestedSort && VALID_SORTS.includes(requestedSort)
        ? requestedSort
        : "newest";

    const result = await discoverProducts({
      query,
      categoryId,
      categorySlug,
      minPrice,
      maxPrice,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      products: result.products,
      total: result.total,
      page,
      limit,
      hasMore: page * limit < result.total,
    });
  } catch (error) {
    console.error("Products API Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}