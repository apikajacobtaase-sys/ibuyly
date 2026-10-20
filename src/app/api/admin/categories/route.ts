// src/app/api/admin/categories/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

// 1. Update the Schema at the top of the file
const CreateCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase with hyphens"),
  parentId: z.string().cuid().optional().nullable().or(z.literal("")),
  imageUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  // 👇 ADD THIS: Default to true (Public) if not provided
  isActive: z.boolean().default(true).optional(), 
});


const UpdateCategorySchema = z.object({
  categoryId: z.string().cuid("Invalid category ID"),
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  parentId: z.string().cuid().optional().nullable().or(z.literal("")),
  description: z.string().optional().nullable().or(z.literal("")),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});


// 2. Update the POST function
export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = CreateCategorySchema.safeParse(body);

    if (!validation.success) {
      console.error("🚨 Category Validation Failed:", validation.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, slug, parentId, imageUrl, isActive } = validation.data;
    
    const cleanParentId = parentId === "" ? null : parentId;
    const cleanIconUrl = imageUrl === "" ? null : imageUrl;

    const existingCategory = await db.category.findUnique({ where: { slug } });
    if (existingCategory) {
      return NextResponse.json({ error: "A category with this slug already exists" }, { status: 400 });
    }

    if (cleanParentId) {
      const parentCategory = await db.category.findUnique({ where: { id: cleanParentId } });
      if (!parentCategory) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 400 });
      }
    }

    // 👇 ADD isActive TO THE CREATE PAYLOAD
    const category = await db.category.create({
      data: {
        name,
        slug,
        iconUrl: cleanIconUrl,
        isActive: isActive ?? true, // Default to Public (true)
        ...(cleanParentId ? {
          parent: { connect: { id: cleanParentId } }
        } : {}),
      },
    });

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: any) {
    console.error("🚨 Admin create category error:", error);
    return NextResponse.json({ error: error.message || "Failed to create category" }, { status: 500 });
  }
}

// Inside src/app/api/admin/categories/route.ts
export async function GET() {
  try {
    const { user, error } = await requireAdmin(); // ✅ Admin check belongs HERE
    if (error) return error;

    const categories = await db.category.findMany({
      orderBy: { name: "asc" },
    });

    const formattedCategories = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.iconUrl || null,
      description: null,
      isActive: c.isActive ?? true,
      parentId: c.parentId || null,
      parentName: null, 
      productCount: 0,  
      childCount: 0,    
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ categories: formattedCategories });
  } catch (error: any) {
    console.error("🚨 Admin categories list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdateCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryId, ...updateData } = validation.data;

    // Check if category exists
    const existingCategory = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If slug is being changed, check if new slug exists
    if (updateData.slug && updateData.slug !== existingCategory.slug) {
      const slugExists = await db.category.findUnique({
        where: { slug: updateData.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A category with this slug already exists" },
          { status: 400 }
        );
      }
    }

    // If parentId is being changed, verify it exists and isn't self-referential
    if (updateData.parentId !== undefined) {
      if (updateData.parentId === categoryId) {
        return NextResponse.json(
          { error: "A category cannot be its own parent" },
          { status: 400 }
        );
      }

      if (updateData.parentId) {
        const parentCategory = await db.category.findUnique({
          where: { id: updateData.parentId },
        });

        if (!parentCategory) {
          return NextResponse.json(
            { error: "Parent category not found" },
            { status: 400 }
          );
        }
      }
    }

    const updatedCategory = await db.category.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      category: updatedCategory,
    });
  } catch (error: any) {
    console.error("🚨 Admin update category error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = DeleteCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryId, reassignToCategoryId } = validation.data;

    // Check if category exists
    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If category has products, require reassignment
    if (category._count.products > 0 && !reassignToCategoryId) {
      return NextResponse.json(
        { 
          error: `This category has ${category._count.products} product(s). Please select a category to reassign them to, or delete the products first.`,
          productCount: category._count.products,
        },
        { status: 400 }
      );
    }

    // If reassigning, verify target category exists
    if (reassignToCategoryId) {
      if (reassignToCategoryId === categoryId) {
        return NextResponse.json(
          { error: "Cannot reassign products to the same category being deleted" },
          { status: 400 }
        );
      }

      const targetCategory = await db.category.findUnique({
        where: { id: reassignToCategoryId },
      });

      if (!targetCategory) {
        return NextResponse.json(
          { error: "Target category for reassignment not found" },
          { status: 400 }
        );
      }

      // Reassign all products to the target category
      await db.product.updateMany({
        where: { categoryId },
        data: { categoryId: reassignToCategoryId },
      });
    }

    // If category has children, make them top-level (remove parent)
    if (category._count.children > 0) {
      await db.category.updateMany({
        where: { parentId: categoryId },
        data: { parentId: null },
      });
    }

    // Delete the category
    await db.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      reassignedProducts: reassignToCategoryId ? category._count.products : 0,
    });
  } catch (error: any) {
    console.error("🚨 Admin delete category error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}