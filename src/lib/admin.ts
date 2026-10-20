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
  const session = await getServerSession(authOptions);
  
  console.log("🔍 requireAdmin - Session:", JSON.stringify(session, null, 2));

  if (!session?.user?.id) {
    console.error("❌ requireAdmin failed: No session.user.id");
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized: No session ID" }, { status: 401 }),
    };
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true },
  });

  console.log("🔍 requireAdmin - DB User:", dbUser);

  if (!dbUser) {
    console.error("❌ requireAdmin failed: User not found in database");
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized: User not found" }, { status: 401 }),
    };
  }

  if (dbUser.role !== "ADMIN" && dbUser.role !== "SUPER_ADMIN") {
    console.error(`❌ requireAdmin failed: Invalid role '${dbUser.role}'. Expected ADMIN or SUPER_ADMIN`);
    return {
      user: null,
      error: NextResponse.json(
        { error: `Forbidden: Admin access required (your role is ${dbUser.role})` },
        { status: 403 }
      ),
    };
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as "ADMIN" | "SUPER_ADMIN",
    },
    error: null,
  };
}