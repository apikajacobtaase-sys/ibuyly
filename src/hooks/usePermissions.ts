// src/hooks/usePermissions.ts
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface SellerPermissions {
  canManageProducts: boolean;
  canManageInventory: boolean;
  canManageOrders: boolean;
  canViewFinances: boolean;
  canManageReviews: boolean;
  canManageSettings: boolean;
  isOwner: boolean;
}

export function useSellerPermissions() {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<SellerPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    async function fetchPermissions() {
      try {
        const res = await fetch("/api/seller/permissions");
        const data = await res.json();
        if (res.ok) {
          setPermissions(data.permissions);
        }
      } catch (error) {
        console.error("Failed to fetch permissions", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [session]);

  return { permissions, isLoading };
}

export function useAdminRole() {
  const { data: session } = useSession();
  
  return {
    isAdmin: session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN",
    isSuperAdmin: session?.user?.role === "SUPER_ADMIN",
    role: session?.user?.role,
  };
}