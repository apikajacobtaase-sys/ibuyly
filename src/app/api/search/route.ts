 import { NextResponse } from "next/server";
import {
  discoverProducts,
  type ProductSort,
} from "@/lib/product-discovery";

const validSorts: ProductSort[] = [
  "newest",
  "price_asc",
  "price_desc",
  "rating",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query =
      searchParams.get("q") ??
      searchParams.get("search") ??
      "";

    const categoryId = searchParams.get("categoryId") ?? undefined;

    const categorySlug =
      searchParams.get("categorySlug") ??
      searchParams.get("category") ??
      undefined;

    const rawMinPrice = searchParams.get("minPrice");
    const rawMaxPrice = searchParams.get("maxPrice");

    const minPrice =
      rawMinPrice !== null ? Number(rawMinPrice) : undefined;

    const maxPrice =
      rawMaxPrice !== null ? Number(rawMaxPrice) : undefined;

    if (
      (minPrice !== undefined && !Number.isFinite(minPrice)) ||
      (maxPrice !== undefined && !Number.isFinite(maxPrice)) ||
      (minPrice !== undefined && minPrice < 0) ||
      (maxPrice !== undefined && maxPrice < 0)
    ) {
      return NextResponse.json(
        { error: "Invalid price filter." },
        { status: 400 }
      );
    }

    const requestedSort = searchParams.get("sort") ?? "newest";

    const sort: ProductSort = validSorts.includes(
      requestedSort as ProductSort
    )
      ? (requestedSort as ProductSort)
      : "newest";

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") ?? "1", 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(
        1,
        parseInt(searchParams.get("limit") ?? "20", 10) || 20
      )
    );

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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search API Error:", error);

    if (
      error instanceof Error &&
      error.message === "Minimum price cannot exceed maximum price."
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch products." },
      { status: 500 }
    );
  }
}