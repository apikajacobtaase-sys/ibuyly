 // src/components/AuthGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation"; // ✅ Added usePathname
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname(); // ✅ Get the current page path

  useEffect(() => {
    if (status === "unauthenticated") {
      // ✅ Use the dynamic pathname instead of hardcoded /cart
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; 
  }

  return <>{children}</>;
}