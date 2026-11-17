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
        isActive: true,
        ...availableCategoryWhere,
      },
      include: {
        children: includeSubcategories
          ? {
              where: {
                isActive: true,
                ...availableCategoryWhere,
              },
              select: {
                id: true,
                name: true,
                slug: true,
                iconUrl: true,
              },
            }
          : false,
      },
      orderBy: { name: "asc" },
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