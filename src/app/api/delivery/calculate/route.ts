// src/app/api/delivery/calculate/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const CalculateDeliverySchema = z.object({
  localityId: z.string().optional(),
  districtId: z.string().optional(),
  regionId: z.string().optional(),
  subtotal: z.number().min(0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = CalculateDeliverySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { localityId, districtId, regionId, subtotal } = validation.data;

    // Find active delivery zone for this location
    let deliveryZone = null;

    if (localityId) {
      deliveryZone = await db.deliveryZone.findFirst({
        where: {
          status: "ACTIVE",
          localities: {
            some: { localityId },
          },
        },
      });
    }

    if (!deliveryZone && districtId) {
      deliveryZone = await db.deliveryZone.findFirst({
        where: {
          status: "ACTIVE",
          localities: {
            some: {
              locality: { districtId },
            },
          },
        },
      });
    }

    if (!deliveryZone && regionId) {
      deliveryZone = await db.deliveryZone.findFirst({
        where: {
          status: "ACTIVE",
          localities: {
            some: {
              locality: {
                district: { regionId },
              },
            },
          },
        },
      });
    }

    // No delivery zone found
    if (!deliveryZone) {
      return NextResponse.json({
        available: false,
        message: "Delivery not available to this location",
        fee: 0,
      });
    }

    // Check minimum order value
    if (deliveryZone.minOrderValue && subtotal < Number(deliveryZone.minOrderValue)) {
      return NextResponse.json({
        available: false,
        message: `Minimum order value is GH₵ ${Number(deliveryZone.minOrderValue).toFixed(2)}`,
        fee: 0,
      });
    }

    // Calculate delivery fee
    const baseFee = Number(deliveryZone.baseDeliveryFee);
    
    // Free delivery if subtotal exceeds a threshold (optional business logic)
    const freeDeliveryThreshold = 200; // GH₵
    const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : baseFee;

    return NextResponse.json({
      available: true,
      fee: deliveryFee,
      estimatedDays: deliveryZone.estimatedDays,
      codEnabled: deliveryZone.codEnabled,
      zoneName: deliveryZone.name,
    });
  } catch (error: any) {
    console.error("🚨 Delivery calculation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}