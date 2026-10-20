import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "No session" });
  }

  const userId = session.user.id;
  
  if (!userId) {
    return NextResponse.json({ 
      session, 
      error: "session.user.id is missing! You need to log out and log back in." 
    });
  }

  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
    },
    dbUser,
    isAdmin: dbUser?.role === "ADMIN" || dbUser?.role === "SUPER_ADMIN",
  });
}