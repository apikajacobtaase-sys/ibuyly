
// src/app/api/addresses/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const CreateAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30),
  alternativePhone: z.string().trim().max(30).optional().nullable(),
  countryId: z.string().cuid(),
  regionId: z.string().cuid(),
  districtId: z.string().cuid(),
  localityId: z.string().cuid(),
  neighbourhood: z.string().trim().max(150).optional().nullable(),
  street: z.string().trim().max(150).optional().nullable(),
  houseNumber: z.string().trim().max(50).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
  deliveryInstructions: z.string().trim().max(1000).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 }
      );
    }

    const validation = CreateAddressSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid address details",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Confirm that the selected locality belongs to the selected district.
    const locality = await db.locality.findUnique({
      where: { id: data.localityId },
      select: {
        id: true,
        districtId: true,
        district: {
          select: {
            id: true,
            regionId: true,
            region: {
              select: {
                id: true,
                countryId: true,
              },
            },
          },
        },
      },
    });

    if (!locality) {
      return NextResponse.json(
        { error: "Selected locality was not found" },
        { status: 400 }
      );
    }

    if (
      locality.districtId !== data.districtId ||
      locality.district.regionId !== data.regionId ||
      locality.district.region.countryId !== data.countryId
    ) {
      return NextResponse.json(
        { error: "The selected address locations do not match" },
        { status: 400 }
      );
    }

    const address = await db.$transaction(async (tx) => {
      // A user's default address should be unique in application behavior.
      // Clear the previous default when a new default is selected.
      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId: session.user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId: session.user.id,
          recipientName: data.recipientName,
          phone: data.phone,
          alternativePhone: data.alternativePhone || null,
          countryId: data.countryId,
          regionId: data.regionId,
          districtId: data.districtId,
          localityId: data.localityId,
          neighbourhood: data.neighbourhood || null,
          street: data.street || null,
          houseNumber: data.houseNumber || null,
          landmark: data.landmark || null,
          deliveryInstructions: data.deliveryInstructions || null,
          isDefault: data.isDefault,
        },
      });
    });

    return NextResponse.json(
      { success: true, address },
      { status: 201 }
    );
  } catch (error) {
    console.error("Address creation error:", error);

    return NextResponse.json(
      { error: "Failed to create address" },
      { status: 500 }
    );
  }
}
