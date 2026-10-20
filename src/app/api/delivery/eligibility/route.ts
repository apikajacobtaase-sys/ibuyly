// src/app/api/delivery/eligibility/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const EligibilitySchema = z.object({
  localityId: z.string().cuid("Invalid locality ID"),
  orderTotal: z.number().min(0, "Order total must be positive"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = EligibilitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { localityId, orderTotal } = validation.data;

    // Find the active delivery zone that covers this locality
    const zoneMapping = await db.deliveryZoneLocality.findFirst({
      where: {
        localityId,
        deliveryZone: {
          status: { in: ["ACTIVE", "RESTRICTED"] }, // Ignore INACTIVE zones
        },
      },
      include: {
        deliveryZone: true,
      },
    });

    if (!zoneMapping) {
      return NextResponse.json({
        eligible: false,
        reason: "UNAVAILABLE",
        message: "We haven't started delivering to this area yet.",
      });
    }

    const zone = zoneMapping.deliveryZone;

    // Check minimum order value
    if (zone.minOrderValue && orderTotal < zone.minOrderValue.toNumber()) {
      return NextResponse.json({
        eligible: false,
        reason: "MINIMUM_ORDER",
        message: `Orders to this area require a minimum basket value of GH₵${zone.minOrderValue.toFixed(2)}.`,
        minOrderValue: zone.minOrderValue.toNumber(),
      });
    }

    // If zone is restricted, allow it but warn the customer
    if (zone.status === "RESTRICTED") {
      return NextResponse.json({
        eligible: true,
        status: "RESTRICTED",
        message: "Delivery to this area is currently limited. Online payment only.",
        deliveryFee: zone.baseDeliveryFee.toNumber(),
        codEnabled: false, // Force online payment if restricted
        estimatedDays: zone.estimatedDays,
      });
    }

    // Fully eligible
    return NextResponse.json({
      eligible: true,
      status: "ACTIVE",
      message: "Great news! We deliver to your area.",
      deliveryFee: zone.baseDeliveryFee.toNumber(),
      codEnabled: zone.codEnabled,
      onlinePayEnabled: zone.onlinePayEnabled,
      estimatedDays: zone.estimatedDays,
      zoneName: zone.name,
    });

  } catch (error) {
    console.error("Delivery eligibility check failed:", error);
    return NextResponse.json({ error: "Failed to check delivery eligibility" }, { status: 500 });
  }
}