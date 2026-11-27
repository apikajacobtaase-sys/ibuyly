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

    let deliveryZone = null;

    // Resolve and validate the complete location hierarchy.
    if (localityId) {
      const locality = await db.locality.findFirst({
        where: {
          id: localityId,
          isActive: true,
          ...(districtId ? { districtId } : {}),
          district: {
            isActive: true,
            ...(regionId ? { regionId } : {}),
            region: { isActive: true },
          },
        },
        include: {
          deliveryZones: {
            where: {
              deliveryZone: { status: "ACTIVE" },
            },
            include: {
              deliveryZone: true,
            },
          },
        },
      });

      deliveryZone = locality?.deliveryZones[0]?.deliveryZone ?? null;
    } else if (districtId) {
      const district = await db.district.findFirst({
        where: {
          id: districtId,
          isActive: true,
          ...(regionId ? { regionId } : {}),
          region: { isActive: true },
        },
        include: {
          localities: {
            where: { isActive: true },
            include: {
              deliveryZones: {
                where: {
                  deliveryZone: { status: "ACTIVE" },
                },
                include: {
                  deliveryZone: true,
                },
              },
            },
          },
        },
      });

      deliveryZone =
        district?.localities
          .flatMap((locality) => locality.deliveryZones)
          .map((item) => item.deliveryZone)[0] ?? null;
    } else if (regionId) {
      const region = await db.region.findFirst({
        where: {
          id: regionId,
          isActive: true,
        },
        include: {
          districts: {
            where: { isActive: true },
            include: {
              localities: {
                where: { isActive: true },
                include: {
                  deliveryZones: {
                    where: {
                      deliveryZone: { status: "ACTIVE" },
                    },
                    include: {
                      deliveryZone: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      deliveryZone =
        region?.districts
          .flatMap((district) => district.localities)
          .flatMap((locality) => locality.deliveryZones)
          .map((item) => item.deliveryZone)[0] ?? null;
    }

    // No delivery zone found.
    if (!deliveryZone) {
      return NextResponse.json({
        available: false,
        message: "Delivery not available to this location",
        fee: 0,
      });
    }

    // Check minimum order value.
    if (
      deliveryZone.minOrderValue &&
      subtotal < Number(deliveryZone.minOrderValue)
    ) {
      return NextResponse.json({
        available: false,
        message: `Minimum order value is GH₵ ${Number(
          deliveryZone.minOrderValue
        ).toFixed(2)}`,
        fee: 0,
      });
    }

    // Calculate delivery fee.
    const baseFee = Number(deliveryZone.baseDeliveryFee);

    // Free delivery for orders of GH₵200 or more.
    const freeDeliveryThreshold = 200;
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

    return NextResponse.json(
      { error: error.message || "Delivery calculation failed" },
      { status: 500 }
    );
  }
}