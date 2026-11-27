 import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const availableProductWhere = {
  status: "ACTIVE" as const,
  variants: {
    some: {
      isActive: true,
      sellerOffers: {
        some: {
          status: "ACTIVE" as const,
          stockQuantity: { gt: 0 },
        },
      },
    },
  },
};

const availableCategoryWhere = {
  OR: [
    {
      products: {
        some: availableProductWhere,
      },
    },
    {
      children: {
        some: {
          isActive: true,
          products: {
            some: availableProductWhere,
          },
        },
      },
    },
  ],
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSubcategories =
      searchParams.get("include") === "subcategories";

    const categories = await db.category.findMany({
  where: {
    parentId: null,
    isActive: true,
  },
  include: {
    children: {
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    },
  },
  orderBy: {
    name: "asc",
  },
});

    const formattedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.iconUrl || null,
      isActive: c.isActive,
      parentId: c.parentId || null,
      children: c.children || [],
    }));

    return NextResponse.json({ categories: formattedCategories });
  } catch (error: any) {
    console.error("Public categories fetch error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}