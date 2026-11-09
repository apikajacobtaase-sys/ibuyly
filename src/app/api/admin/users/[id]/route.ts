// src/app/api/admin/users/[id]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { role, accountStatus, reason } = body;

    // 🔒 SECURITY: Prevent Super Admin from demoting or suspending themselves
    if (id === session.user.id) {
      if (role && role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "You cannot change your own role from SUPER_ADMIN" }, { status: 400 });
      }
      if (accountStatus && accountStatus !== "ACTIVE") {
        return NextResponse.json({ error: "You cannot suspend or disable your own account" }, { status: 400 });
      }
    }

    // 👇 FIX: Updated to match your exact Prisma schema enum
    // Seller roles must only be granted through the approved seller workflow.
    const validRoles = ["CUSTOMER", "SUPPORT", "ADMIN", "SUPER_ADMIN"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const validStatuses = ["ACTIVE", "SUSPENDED", "DISABLED"];
    if (accountStatus && !validStatuses.includes(accountStatus)) {
      return NextResponse.json({ error: "Invalid status specified" }, { status: 400 });
    }

    // Build the update data object dynamically based on what was sent
    const updateData: any = {};
    if (role) updateData.role = role;
    if (accountStatus) updateData.accountStatus = accountStatus;

    // Update the user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        accountStatus: true,
      },
    });


    // Create audit logs for what was changed
    const auditActions = [];
    if (role) auditActions.push(`USER_ROLE_CHANGED_TO_${role}`);
    if (accountStatus) auditActions.push(`USER_STATUS_${accountStatus}`);

    if (auditActions.length > 0) {
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: auditActions.join(" & "),
          resourceType: "User",
          resourceId: id,
          metadata: { 
            targetEmail: updatedUser.email, 
            newRole: role || updatedUser.role,
            newStatus: accountStatus || updatedUser.accountStatus,
            reason: reason || "No reason provided" 
          },
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "User updated successfully",
      user: updatedUser 
    });

  } catch (error: any) {
    // 👇 THIS CATCH BLOCK WAS MISSING!
    console.error("User update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}