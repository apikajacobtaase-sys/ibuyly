// src/app/admin/users/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ClientUserManagement from "@/components/ClientUserManagement";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  // 🔒 Protect the page: Only Super Admins can view this
  if (!session || session.user?.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  // Fetch all users directly on the server for speed and security
  const users = await db.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <ClientUserManagement initialUsers={users} />;
}