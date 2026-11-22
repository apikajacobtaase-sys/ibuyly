 import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ContentSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(slugRegex),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.record(z.string(), z.unknown()),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

const UpdateSchema = ContentSchema.partial().extend({
  pageId: z.string().cuid(),
});

// GET: List all content pages
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const pages = await db.contentPage.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        content: true,
          seoTitle: true,
          seoDescription: true,
        updatedAt: true,
        createdBy: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("CMS list error:", error);

    return NextResponse.json(
      { error: "Failed to fetch content pages" },
      { status: 500 }
    );
  }
}

// POST: Create a content page
export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const validation = ContentSchema.safeParse(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid content data",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const existing = await db.contentPage.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A page with this slug already exists" },
        { status: 409 }
      );
    }

    const page = await db.contentPage.create({
      data: {
        ...data,
        content: data.content as Prisma.InputJsonValue,
        excerpt: data.excerpt || null,
        coverImage: data.coverImage || null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        createdById: user.id,
        publishedAt:
          data.status === "PUBLISHED" ? new Date() : null,
      },
    });

    return NextResponse.json(
      { success: true, page },
      { status: 201 }
    );
  } catch (error) {
    console.error("CMS create error:", error);

    return NextResponse.json(
      { error: "Failed to create content page" },
      { status: 500 }
    );
  }
}

// PATCH: Update a content page
export async function PATCH(req: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const validation = UpdateSchema.safeParse(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid content data",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { pageId, content, ...data } = validation.data;

    const existing = await db.contentPage.findUnique({
      where: { id: pageId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Content page not found" },
        { status: 404 }
      );
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await db.contentPage.findUnique({
        where: { slug: data.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A page with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const page = await db.contentPage.update({
      where: { id: pageId },
      data: {
        ...data,

        ...(content !== undefined && {
  content: content as Prisma.InputJsonValue,
}),
        ...(data.excerpt !== undefined && {
          excerpt: data.excerpt || null,
        }),

        ...(data.coverImage !== undefined && {
          coverImage: data.coverImage || null,
        }),

        ...(data.seoTitle !== undefined && {
          seoTitle: data.seoTitle || null,
        }),

        ...(data.seoDescription !== undefined && {
          seoDescription: data.seoDescription || null,
        }),

        ...(data.status !== undefined && {
          publishedAt:
            data.status === "PUBLISHED"
              ? existing.publishedAt || new Date()
              : null,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      page,
    });
  } catch (error) {
    console.error("CMS update error:", error);

    return NextResponse.json(
      { error: "Failed to update content page" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a content page
export async function DELETE(req: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();

    const validation = z
      .object({ pageId: z.string().cuid() })
      .safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid page ID" },
        { status: 400 }
      );
    }

    const page = await db.contentPage.findUnique({
      where: { id: validation.data.pageId },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Content page not found" },
        { status: 404 }
      );
    }

    await db.contentPage.delete({
      where: { id: page.id },
    });

    return NextResponse.json({
      success: true,
      message: "Content page deleted",
    });
  } catch (error) {
    console.error("CMS delete error:", error);

    return NextResponse.json(
      { error: "Failed to delete content page" },
      { status: 500 }
    );
  }
}