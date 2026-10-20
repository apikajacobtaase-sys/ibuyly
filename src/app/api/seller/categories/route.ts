// src/app/api/categories/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    // Fetch all top-level categories and include their children
    const categories = await db.category.findMany({
      where: {
        parentId: null, // Only get top-level categories
        // isActive: true, // Uncomment if your schema has an isActive field
      },
      include: {
        children: {
          // isActive: true, // Uncomment if your schema has an isActive field
          orderBy: {
            name: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("🚨 Fetch categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}


// ✅ ADD THIS POST HANDLER
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, parentId } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Create a unique slug
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const newCategory = await db.category.create({
      data: {
        name: name.trim(),
        slug: slug,
        parentId: parentId || null,
      },
    });

    return NextResponse.json({ success: true, category: newCategory }, { status: 201 });

  } catch (error: any) {
    console.error("🚨 Create Category Error:", error);
    return NextResponse.json(
      { error: "Failed to create category", details: error.message },
      { status: 500 }
    );
  }
}