 import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const localityIdsSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate locality IDs are not allowed",
  });

const CreateZoneSchema = z.object({
  name: z.string().min(2, "Zone name is required"),
  status: z.enum([
    "ACTIVE",
    "RESTRICTED",
    "INACTIVE",
    "TEMPORARILY_UNAVAILABLE",
  ]),
  baseDeliveryFee: z.coerce.number().min(0, "Fee must be 0 or greater"),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  codEnabled: z.coerce.boolean().optional().default(false),
  onlinePayEnabled: z.coerce.boolean().optional().default(true),
  estimatedDays: z.coerce.number().min(1).optional().nullable(),
  notes: z.string().optional(),
  localityIds: localityIdsSchema.min(1, "At least one locality is required"),
});

const UpdateZoneSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(2).max(100),
  status: z.enum([
    "ACTIVE",
    "RESTRICTED",
    "INACTIVE",
    "TEMPORARILY_UNAVAILABLE",
  ]),
  baseDeliveryFee: z.coerce.number().min(0),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  onlinePayEnabled: z.coerce.boolean().optional(),
  codEnabled: z.coerce.boolean(),
  estimatedDays: z.coerce.number().min(1).max(30).optional().nullable(),
  localityIds: localityIdsSchema.optional(),
});

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function localityConflictResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "LOCALITY_ALREADY_ASSIGNED",
      error:
        "One or more selected localities are already assigned to another delivery zone.",
    },
    { status: 409 }
  );
}

async function validateActiveLocalities(localityIds: string[]) {
  if (localityIds.length === 0) return null;

  const localities = await db.locality.findMany({
    where: {
      id: { in: localityIds },
    },
    select: {
      id: true,
      isActive: true,
      district: {
        select: {
          isActive: true,
          region: {
            select: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (localities.length !== localityIds.length) {
    return "One or more selected localities do not exist.";
  }

  const unavailable = localities.some(
    (locality) =>
      !locality.isActive ||
      !locality.district.isActive ||
      !locality.district.region.isActive
  );

  if (unavailable) {
    return "Some selected localities are inactive or belong to an inactive district or region.";
  }

  return null;
}

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
                district: {
                  include: { region: true },
                },
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

    return NextResponse.json(
      { error: "Failed to fetch zones" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = CreateZoneSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { localityIds, ...zoneData } = validation.data;

    const localityError = await validateActiveLocalities(localityIds);

    if (localityError) {
      return NextResponse.json(
        { success: false, error: localityError },
        { status: 400 }
      );
    }

    const newZone = await db.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.create({
        data: {
          ...zoneData,
          minOrderValue: zoneData.minOrderValue ?? null,
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

    return NextResponse.json(
      { success: true, zone: newZone },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create zone error:", error);

    if (isUniqueConstraintError(error)) {
      return localityConflictResponse();
    }

    return NextResponse.json(
      { error: "Failed to create zone" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { error } = await requireAdmin();

    if (error) return error;

    const body = await req.json();
    const validation = UpdateZoneSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      zoneId,
      name,
      status,
      baseDeliveryFee,
      minOrderValue,
      codEnabled,
      onlinePayEnabled,
      estimatedDays,
      localityIds,
    } = validation.data;

    if (localityIds !== undefined) {
      const localityError = await validateActiveLocalities(localityIds);

      if (localityError) {
        return NextResponse.json(
          { success: false, error: localityError },
          { status: 400 }
        );
      }
    }

    const updatedZone = await db.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.update({
        where: { id: zoneId },
        data: {
          name,
          status,
          baseDeliveryFee,
          minOrderValue: minOrderValue ?? null,
          codEnabled,
          ...(onlinePayEnabled !== undefined ? { onlinePayEnabled } : {}),
          estimatedDays: estimatedDays ?? null,
        },
      });

      if (localityIds !== undefined) {
        await tx.deliveryZoneLocality.deleteMany({
          where: { deliveryZoneId: zoneId },
        });

        if (localityIds.length > 0) {
          await tx.deliveryZoneLocality.createMany({
            data: localityIds.map((localityId) => ({
              deliveryZoneId: zoneId,
              localityId,
            })),
          });
        }
      }

      return zone;
    });

    return NextResponse.json({
      success: true,
      zone: updatedZone,
    });
  } catch (error) {
    console.error("Update zone error:", error);

    if (isUniqueConstraintError(error)) {
      return localityConflictResponse();
    }

    return NextResponse.json(
      { error: "Failed to update zone" },
      { status: 500 }
    );
  }
}