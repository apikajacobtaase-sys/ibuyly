// src/app/api/categories/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSubcategories = searchParams.get("include") === "subcategories";

    // 👇 PUBLIC API: Only fetch categories that are isActive: true (Public)
    const categories = await db.category.findMany({
      where: {
        isActive: true, 
      },
      include: {
        // Only include children if explicitly requested (e.g., by the Categories page)
        // And only include children that are ALSO active
        children: includeSubcategories ? {
          where: { isActive: true },
          select: { 
            id: true, 
            name: true, 
            slug: true, 
            iconUrl: true 
          }
        } : false,
      },
      orderBy: { name: "asc" },
    });

    // Format for the frontend
    const formattedCategories = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.iconUrl || null, // Map iconUrl to imageUrl for frontend compatibility
      isActive: c.isActive,
      parentId: c.parentId || null,
      children: c.children || [],
    }));

    return NextResponse.json({ categories: formattedCategories });
  } catch (error: any) {
    console.error("🚨 Public categories fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}