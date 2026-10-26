// src/lib/admin.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type AdminUser = {
  id: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type AdminResult =
  | { user: AdminUser; error: null }
  | { user: null; error: NextResponse };

export async function requireAdmin(): Promise<AdminResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    // Verify the user's current permissions against the database.
    const dbUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Account is inactive or unavailable" },
          { status: 403 }
        ),
      };
    }

    if (
      dbUser.role !== "ADMIN" &&
      dbUser.role !== "SUPER_ADMIN"
    ) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Administrator access required" },
          { status: 403 }
        ),
      };
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
      },
      error: null,
    };
  } catch (error) {
    console.error("Admin authorization failed:", error);

    return {
      user: null,
      error: NextResponse.json(
        { error: "Unable to verify administrator permissions" },
        { status: 500 }
      ),
    };
  }
}
