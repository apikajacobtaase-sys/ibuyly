 import { NextResponse } from "next/server";
import { discoverProducts } from "@/lib/product-discovery";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productIds = body?.productIds;

    if (
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      productIds.length > 10 ||
      !productIds.every(
        (id: unknown) => typeof id === "string" && id.trim().length > 0
      )
    ) {
      return NextResponse.json(
        { error: "Provide between 1 and 10 valid product IDs." },
        { status: 400 }
      );
    }

    const uniqueIds = [...new Set(productIds.map((id: string) => id.trim()))];

    const result = await discoverProducts({
      productIds: uniqueIds,
      limit: 10,
      sort: "newest",
    });

    // Preserve the original recently viewed order.
    const productMap = new Map(
      result.products.map((product) => [product.id, product])
    );

    const products = uniqueIds
      .map((id) => productMap.get(id))
      .filter((product) => product !== undefined);

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Recently Viewed API Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch recently viewed products." },
      { status: 500 }
    );
  }
}