 import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

import DashboardShell from "@/components/dashboard/DashboardShell";
import SellerStoreSwitcher from "@/components/dashboard/SellerStoreSwitcher";
import { sellerSidebarItems } from "@/lib/sellerSidebar";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Require authentication.
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fseller");
  }

  const userId = session.user.id;

  // Require an active, verified store owned by the user
  // or an active membership in an eligible store.
  const sellerStore = await db.sellerProfile.findFirst({
    where: {
      isActive: true,
      verificationStatus: "VERIFIED",
      OR: [
        { userId },
        {
          memberships: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  // Platform administrator privileges do not grant seller access.
  if (!sellerStore) {
    redirect("/account");
  }

  return (
    <DashboardShell
      sidebarItems={sellerSidebarItems}
      title="Seller Dashboard"
      logo="S"
      accentColor="bg-teal-600"
    >
      <div className="min-w-0">
        <SellerStoreSwitcher />
        {children}
      </div>
    </DashboardShell>
  );
}