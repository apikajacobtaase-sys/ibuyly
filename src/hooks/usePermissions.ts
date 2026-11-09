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

interface SellerPermissionsResponse {
  permissions: SellerPermissions | null;
  sellerId?: string;
  requiresStoreSelection?: boolean;
  sellerIds?: string[];
  error?: string;
}

export function useSellerPermissions() {
  const { data: session, status } = useSession();

  const [permissions, setPermissions] =
    useState<SellerPermissions | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [requiresStoreSelection, setRequiresStoreSelection] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (status === "loading") {
      setIsLoading(true);
      return;
    }

    if (!session?.user) {
      setPermissions(null);
      setSellerId(null);
      setRequiresStoreSelection(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    async function fetchPermissions() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/seller/permissions", {
          cache: "no-store",
        });

        const data =
          (await response.json()) as SellerPermissionsResponse;

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to fetch seller permissions."
          );
        }

        if (cancelled) return;

        setPermissions(data.permissions);
        setSellerId(data.sellerId ?? null);
        setRequiresStoreSelection(
          data.requiresStoreSelection === true
        );
      } catch (err) {
        if (!cancelled) {
          setPermissions(null);
          setSellerId(null);
          setRequiresStoreSelection(false);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch seller permissions."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  return {
    permissions,
    sellerId,
    requiresStoreSelection,
    isLoading,
    error,
  };
}

export function useAdminRole() {
  const { data: session } = useSession();

  return {
    isAdmin:
      session?.user?.role === "ADMIN" ||
      session?.user?.role === "SUPER_ADMIN",
    isSuperAdmin: session?.user?.role === "SUPER_ADMIN",
    role: session?.user?.role,
  };
}