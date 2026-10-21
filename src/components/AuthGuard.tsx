 // src/components/AuthGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router, isClient]);

  // ✅ Show loader while checking session or if not mounted yet
  if (!isClient || status === "loading") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Securing your cart...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; 
  }

  return <>{children}</>;
}