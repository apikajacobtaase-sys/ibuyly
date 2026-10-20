 // src/app/api/admin/delivery/zones/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
  
const CreateZoneSchema = z.object({
  name: z.string().min(2, "Zone name is required"),
  status: z.enum(["ACTIVE", "RESTRICTED", "INACTIVE", "TEMPORARILY_UNAVAILABLE"]),
  baseDeliveryFee: z.coerce.number().min(0, "Fee must be 0 or greater"),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  codEnabled: z.coerce.boolean().optional().default(false),
  onlinePayEnabled: z.coerce.boolean().optional().default(true), // 👈 MUST HAVE THIS EXACT TEXT
  estimatedDays: z.coerce.number().min(1).optional().nullable(),
  notes: z.string().optional(),
  localityIds: z.array(z.string().min(1)).min(1, "At least one locality is required"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const zones = await db.deliveryZone.findMany({
      include: {
        localities: {
          include: {
            locality: {
              include: {
                district: { include: { region: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ zones });
  } catch (error) {
    console.error("Fetch zones error:", error);
    return NextResponse.json({ error: "Failed to fetch zones" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    
    // 👇 DEBUG: Log the raw body to see exactly what the frontend is sending
    console.log("🔍 Raw Zone Creation Body:", body);

    const validation = CreateZoneSchema.safeParse(body);

    if (!validation.success) {
      console.error("🚨 Zone Creation Validation Failed:", validation.error.flatten());
      return NextResponse.json({ 
        error: "Invalid request", 
        details: validation.error.flatten() 
      }, { status: 400 });
    }

    const { localityIds, ...zoneData } = validation.data;

    const newZone = await db.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.create({
        data: {
          ...zoneData,
          minOrderValue: zoneData.minOrderValue || null,
        },
      });

      await tx.deliveryZoneLocality.createMany({
        data: localityIds.map((localityId) => ({
          deliveryZoneId: zone.id,
          localityId,
        })),
      });

      return zone;
    });

    return NextResponse.json({ success: true, zone: newZone }, { status: 201 });
  } catch (error: any) {
    console.error("Create zone error:", error);
    return NextResponse.json({ error: error.message || "Failed to create zone" }, { status: 500 });
  }
}

// 👇 UPDATED: Use z.coerce for PATCH as well
const UpdateZoneSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(2).max(100),
  status: z.enum(["ACTIVE", "RESTRICTED", "INACTIVE", "TEMPORARILY_UNAVAILABLE"]),
  baseDeliveryFee: z.coerce.number().min(0),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  onlinePayEnabled: z.coerce.boolean().optional().default(true), // 👈 FIXED: Now optional with a default
  codEnabled: z.coerce.boolean(),
  estimatedDays: z.coerce.number().min(1).max(30).optional().nullable(),
  localityIds: z.array(z.string().min(1)).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const validation = UpdateZoneSchema.safeParse(body);

    if (!validation.success) {
      console.error("🚨 Zone Update Validation Failed:", validation.error.flatten());
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() }, 
        { status: 400 }
      );
    }

    const { zoneId, name, status, baseDeliveryFee, minOrderValue, codEnabled, estimatedDays, localityIds } = validation.data;

    const updatedZone = await db.deliveryZone.update({
      where: { id: zoneId },
      data: {
        name,
        status,
        baseDeliveryFee,
        minOrderValue: minOrderValue || null,
        codEnabled,
        estimatedDays: estimatedDays || null,
      },
    });

    if (localityIds) {
      await db.deliveryZoneLocality.deleteMany({
        where: { deliveryZoneId: zoneId },
      });

      if (localityIds.length > 0) {
        await db.deliveryZoneLocality.createMany({
          data: localityIds.map((localityId) => ({
            deliveryZoneId: zoneId,
            localityId,
          })),
        });
      }
    }
    
    return NextResponse.json({ success: true, zone: updatedZone });
  } catch (error: any) {
    console.error("🚨 Admin update zone error:", error);
    return NextResponse.json({ error: error.message || "Failed to update zone" }, { status: 500 });
  }
}