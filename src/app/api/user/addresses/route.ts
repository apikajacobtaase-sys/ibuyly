// src/app/api/user/addresses/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const AddressSchema = z.object({
  recipientName: z.string().min(2, "Recipient name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  alternativePhone: z.string().optional(),
  countryId: z.string().default("ghana"), // Will be validated against DB
  regionId: z.string().cuid("Invalid region"),
  districtId: z.string().cuid("Invalid district"),
  localityId: z.string().cuid("Invalid locality"),
  neighbourhood: z.string().min(2, "Neighbourhood is required"),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  landmark: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = AddressSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // SERVER-SIDE HIERARCHY VALIDATION
    // Verify that the district belongs to the region, and locality belongs to the district
    const localityCheck = await db.locality.findUnique({
      where: { id: data.localityId },
      include: { district: { include: { region: true } } },
    });

    if (!localityCheck) {
      return NextResponse.json({ error: "Invalid locality selected" }, { status: 400 });
    }

    if (localityCheck.districtId !== data.districtId) {
      return NextResponse.json({ error: "District does not match the selected locality" }, { status: 400 });
    }

    if (localityCheck.district.regionId !== data.regionId) {
      return NextResponse.json({ error: "Region does not match the selected district" }, { status: 400 });
    }

    // If setting as default, unset other defaults for this user
    if (data.isDefault) {
      await db.address.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newAddress = await db.address.create({
      data: {
        userId: session.user.id,
        recipientName: data.recipientName,
        phone: data.phone,
        alternativePhone: data.alternativePhone || null,
        countryId: "ghana", // Hardcoded for now, matches seed
        regionId: data.regionId,
        districtId: data.districtId,
        localityId: data.localityId,
        neighbourhood: data.neighbourhood,
        street: data.street || null,
        houseNumber: data.houseNumber || null,
        landmark: data.landmark || null,
        deliveryInstructions: data.deliveryInstructions || null,
        isDefault: data.isDefault,
      },
      include: {
        region: { select: { name: true } },
        district: { select: { name: true } },
        locality: { select: { name: true } },
      }
    });

    return NextResponse.json({ success: true, address: newAddress }, { status: 201 });
  } catch (error: any) {
    console.error("Create address error:", error);
    return NextResponse.json({ error: error.message || "Failed to save address" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const addresses = await db.address.findMany({
      where: { userId: session.user.id },
      include: {
        region: { select: { name: true } },
        district: { select: { name: true } },
        locality: { select: { name: true } },
      },
      orderBy: { isDefault: "desc" },
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("Fetch addresses error:", error);
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}