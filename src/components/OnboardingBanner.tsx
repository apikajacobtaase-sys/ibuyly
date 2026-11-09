"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function OnboardingBanner() {
const { data: session, status } = useSession();

if (status !== "authenticated" || session?.user?.role !== "ADMIN") {
return null;
}

return ( <div className="bg-blue-50 border-b border-blue-200 p-4"> <div className="max-w-7xl mx-auto flex items-center justify-between gap-4"> <div className="flex items-center gap-3"> <Shield className="w-6 h-6 text-blue-600" /> <div> <p className="font-bold text-blue-900">
🎉 Admin Access Granted! </p> <p className="text-blue-700 text-sm">
Your account has been upgraded. You can now manage categories,
users, and platform settings. </p> </div> </div>
    <Link
      href="/admin"
      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
    >
      Go to Admin Panel
    </Link>
  </div>
</div>
);
}
