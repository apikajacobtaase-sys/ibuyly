 // src/app/api/delivery/quote/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const quoteSchema = z.object({
  localityId: z.string().min(1, "Locality ID is required"),
  subtotal: z.coerce.number().min(0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = quoteSchema.parse(body);

    // 1. Fetch the locality and the ACTUAL delivery zone data
    const locality = await db.locality.findUnique({
      where: { id: validated.localityId },
      include: {
        district: { include: { region: true } },
        deliveryZones: {
          include: {
            deliveryZone: true, // 👈 CRITICAL FIX: Fetch the actual zone data (status, fees, etc.)
          },
        },
      },
    });

    if (!locality) {
      return NextResponse.json({
        isServiceable: false,
        message: "We couldn't find this location in our database.",
      });
    }

    // 2. Find the link that has an ACTIVE delivery zone
    const activeLink = locality.deliveryZones.find(
      (link: any) => link.deliveryZone.status === "ACTIVE"
    );

    if (!activeLink) {
      return NextResponse.json({
        isServiceable: false,
        message: `We do not currently deliver to ${locality.name}.`,
        canRequestCoverage: true,
      });
    }

    // 👇 Extract the actual zone data from the link
    const activeZone = activeLink.deliveryZone;

    const deliveryFee = parseFloat(activeZone.baseDeliveryFee.toString());
    const minOrderValue = activeZone.minOrderValue ? parseFloat(activeZone.minOrderValue.toString()) : null;
    const minOrderMet = minOrderValue ? validated.subtotal >= minOrderValue : true;

    return NextResponse.json({
      isServiceable: true,
      deliveryFee,
      minOrderValue,
      minOrderMet,
      estimatedDays: activeZone.estimatedDeliveryDays || null,
      codEnabled: activeZone.codEnabled || false,
    });

  } catch (error: any) {
    console.error("🚨 Delivery quote error:", error);
    if (error.name === "ZodError" && error.errors?.length > 0) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to calculate delivery quote" }, { status: 500 });
  }
}