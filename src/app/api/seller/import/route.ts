import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import Papa from "papaparse";
import { z } from "zod";

export const runtime = "nodejs";

const ImportRowSchema = z.object({
  variantId: z.string().trim().min(1).max(191),
  price: z.coerce.number().finite().positive().max(99999999.99),
  stock: z.coerce.number().int().min(0).max(2147483647),
  sku: z.string().trim().max(100).optional().default(""),
  condition: z.string().trim().min(1).max(50).default("NEW"),
}).strict();

export async function POST(req: Request) {
  try {
    const productAccess = await authorizeSeller("manage_products");

    if (!productAccess.authorized) {
      return productAccess.response;
    }

    const inventoryAccess = await authorizeSeller(
      "manage_inventory",
      productAccess.sellerId
    );

    if (!inventoryAccess.authorized) {
      return inventoryAccess.response;
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A CSV file is required." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be between 1 byte and 1 MB." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported." },
        { status: 400 }
      );
    }

    const text = await file.text();

    if (text.includes("\u0000")) {
      return NextResponse.json(
        { error: "Invalid CSV file." },
        { status: 400 }
      );
    }

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV parsing failed.",
          details: parsed.errors.slice(0, 10).map((error) => error.message),
        },
        { status: 400 }
      );
    }

    const expectedHeaders = [
      "variantId",
      "price",
      "stock",
      "sku",
      "condition",
    ];

    const headers = parsed.meta.fields ?? [];

    if (
      headers.length !== expectedHeaders.length ||
      !expectedHeaders.every((header) => headers.includes(header))
    ) {
      return NextResponse.json(
        {
          error: "Invalid CSV headers.",
          expected: expectedHeaders.join(","),
        },
        { status: 400 }
      );
    }

    const rows = parsed.data;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV file contains no products." },
        { status: 400 }
      );
    }

    if (rows.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 offers per import." },
        { status: 400 }
      );
    }

    const created: { variantId: string; offerId: string }[] = [];
    const errors: string[] = [];
    const seenVariants = new Set<string>();

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2;
      const validation = ImportRowSchema.safeParse(rows[index]);

      if (!validation.success) {
        errors.push(`Row ${rowNumber}: Invalid data.`);
        continue;
      }

      const data = validation.data;

      if (seenVariants.has(data.variantId)) {
        errors.push(`Row ${rowNumber}: Duplicate variant ID in this file.`);
        continue;
      }

      seenVariants.add(data.variantId);

      try {
        const variant = await db.productVariant.findFirst({
          where: {
            id: data.variantId,
            isActive: true,
            product: {
              status: "ACTIVE",
            },
          },
          select: { id: true },
        });

        if (!variant) {
          errors.push(
            `Row ${rowNumber}: Catalogue variant not found or unavailable.`
          );
          continue;
        }

        const existingOffer = await db.sellerOffer.findUnique({
          where: {
            sellerId_variantId: {
              sellerId: productAccess.sellerId,
              variantId: variant.id,
            },
          },
          select: { id: true },
        });

        if (existingOffer) {
          errors.push(
            `Row ${rowNumber}: You already have an offer for this variant.`
          );
          continue;
        }

        const offer = await db.sellerOffer.create({
          data: {
            sellerId: productAccess.sellerId,
            variantId: variant.id,
            price: data.price,
            stockQuantity: data.stock,
            sellerSku: data.sku || null,
            condition: data.condition,
            status: data.stock > 0 ? "ACTIVE" : "OUT_OF_STOCK",
          },
          select: { id: true },
        });

        created.push({
          variantId: variant.id,
          offerId: offer.id,
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          errors.push(
            `Row ${rowNumber}: This variant or seller SKU already exists.`
          );
          continue;
        }

        console.error(`Seller import row ${rowNumber} failed:`, error);
        errors.push(`Row ${rowNumber}: Import failed.`);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length,
      details: { created, errors },
    });
  } catch (error) {
    console.error("Seller CSV import error:", error);

    return NextResponse.json(
      { error: "Failed to import seller offers." },
      { status: 500 }
    );
  }
}