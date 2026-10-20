// src/app/api/seller/products/import/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import Papa from "papaparse";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const categoryId = formData.get("categoryId") as string;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "Category ID is required" }, { status: 400 });

    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    if (rows.length === 0) return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    if (rows.length > 100) return NextResponse.json({ error: "Maximum 100 products per import" }, { status: 400 });

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = row.title?.trim();
      const description = row.description?.trim() || "No description";
      const price = parseFloat(row.price);
      const stock = parseInt(row.stock) || 0;
      const sku = row.sku?.trim() || `SKU-${Date.now()}-${i}`;

      if (!title || isNaN(price)) {
        errors.push(`Row ${i + 2}: Missing title or invalid price`);
        continue;
      }

      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;

      try {
        const product = await db.product.create({
          data: {
            title,
            slug,
            description,
            categoryId,
            sellerId: seller.id,
            status: "DRAFT",
            variants: {
              create: {
                price,
                stockQuantity: stock,
                sku,
              },
            },
          },
        });
        created.push({ title, id: product.id });
      } catch (err: any) {
        errors.push(`Row ${i + 2} (${title}): ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length,
      details: { created, errors },
    });
  } catch (error: any) {
    console.error("🚨 CSV import error:", error);
    return NextResponse.json({ error: error.message || "Failed to import products" }, { status: 500 });
  }
}