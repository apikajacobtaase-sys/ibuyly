import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeSeller } from "@/lib/seller-auth";
import { z } from "zod";

const permissionsSchema = z.object({
  canManageProducts: z.boolean().optional().default(false),
  canManageInventory: z.boolean().optional().default(false),
  canManageOrders: z.boolean().optional().default(false),
  canViewFinances: z.boolean().optional().default(false),
  canManageReviews: z.boolean().optional().default(false),
  canManageSettings: z.boolean().optional().default(false),
}).strict();

const addStaffSchema = z.object({
  email: z.string().trim().email().max(254),
  permissions: permissionsSchema.optional().default({
    canManageProducts: false,
    canManageInventory: false,
    canManageOrders: false,
    canViewFinances: false,
    canManageReviews: false,
    canManageSettings: false,
  }),
}).strict();

export async function GET() {
  try {
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the store owner can manage staff" },
        { status: 403 }
      );
    }

    const memberships = await db.sellerMembership.findMany({
      where: { sellerId: access.sellerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      staff: memberships.map((membership) => ({
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        name:
          `${membership.user.firstName || ""} ${membership.user.lastName || ""}`.trim() ||
          membership.user.email,
        role: membership.role,
        permissions: {
          canManageProducts: membership.canManageProducts,
          canManageInventory: membership.canManageInventory,
          canManageOrders: membership.canManageOrders,
          canViewFinances: membership.canViewFinances,
          canManageReviews: membership.canManageReviews,
          canManageSettings: membership.canManageSettings,
        },
        isActive: membership.isActive,
        createdAt: membership.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch seller staff error:", error);

    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeSeller("manage_settings");

    if (!access.authorized) return access.response;

    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the store owner can add staff" },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = addStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid staff details",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const permissions = parsed.data.permissions;

    const targetUser = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User with this email does not exist" },
        { status: 404 }
      );
    }

    if (targetUser.id === access.userId) {
      return NextResponse.json(
        { error: "You cannot add yourself as staff" },
        { status: 400 }
      );
    }

    const existing = await db.sellerMembership.findUnique({
      where: {
        userId_sellerId: {
          userId: targetUser.id,
          sellerId: access.sellerId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this store" },
        { status: 409 }
      );
    }

    const membership = await db.$transaction(async (tx) => {
      const created = await tx.sellerMembership.create({
        data: {
          userId: targetUser.id,
          sellerId: access.sellerId,
          role: "STAFF",
          canManageProducts: permissions.canManageProducts,
          canManageInventory: permissions.canManageInventory,
          canManageOrders: permissions.canManageOrders,
          canViewFinances: permissions.canViewFinances,
          canManageReviews: permissions.canManageReviews,
          canManageSettings: permissions.canManageSettings,
          isActive: true,
          invitedBy: access.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: access.userId,
          action: "SELLER_STAFF_ADDED",
          resourceType: "SellerMembership",
          resourceId: created.id,
          metadata: {
            targetEmail: email,
            sellerId: access.sellerId,
            permissions,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        membership: {
          id: membership.id,
          userId: membership.userId,
          sellerId: membership.sellerId,
          role: membership.role,
          permissions,
          isActive: membership.isActive,
          createdAt: membership.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add seller staff error:", error);

    return NextResponse.json(
      { error: "Failed to add staff member" },
      { status: 500 }
    );
  }
}