 import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const BannerSchema = z.object({
  title: z.string().min(2).max(120),
  subtitle: z.string().max(250).optional().nullable(),
  imageUrl: z.string().url(),
  mobileImageUrl: z.string().url().optional().nullable(),
  altText: z.string().max(200).optional().nullable(),
  buttonText: z.string().max(40).optional().nullable(),
  buttonUrl: z.string().max(500).optional().nullable(),
  placement: z.enum(["HOME_HERO", "HOME_MIDDLE", "HOME_BOTTOM"]).default("HOME_HERO"),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const banners = await db.promotionBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Fetch banners error:", error);
    return NextResponse.json({ error: "Failed to fetch banners" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const validation = BannerSchema.safeParse(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid banner data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const banner = await db.promotionBanner.create({
      data: {
        ...data,
        subtitle: data.subtitle || null,
        mobileImageUrl: data.mobileImageUrl || null,
        altText: data.altText || null,
        buttonText: data.buttonText || null,
        buttonUrl: data.buttonUrl || null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });

    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error) {
    console.error("Create banner error:", error);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const id = body.id;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Banner ID is required" }, { status: 400 });
    }

    const validation = BannerSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid banner data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const banner = await db.promotionBanner.update({
      where: { id },
      data: {
        ...data,
        startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : undefined,
        endsAt: data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : undefined,
      },
    });

    return NextResponse.json({ success: true, banner });
  } catch (error: any) {
    console.error("Update banner error:", error);
    return NextResponse.json(
      { error: error.code === "P2025" ? "Banner not found" : "Failed to update banner" },
      { status: error.code === "P2025" ? 404 : 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await req.json();

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Banner ID is required" }, { status: 400 });
    }

    await db.promotionBanner.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.code === "P2025" ? "Banner not found" : "Failed to delete banner" },
      { status: error.code === "P2025" ? 404 : 500 }
    );
  }
}