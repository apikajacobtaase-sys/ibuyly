 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, RefreshCw, Wrench } from "lucide-react";

export default function MaintenancePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [expectedBackAt, setExpectedBackAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/maintenance-status", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();

        if (!active) return;

        // Keep the page visible if the status service is unavailable.
        if (data.unavailable === true) return;

        // Automatically return visitors to the marketplace.
        if (data.maintenanceMode !== true) {
          router.replace("/");
          return;
        }

        setMessage(data.message ?? "");
        setExpectedBackAt(data.expectedBackAt ?? null);
      } catch {
        // Keep the default maintenance message.
      }
    }

    loadStatus();

    // Check every 30 seconds for maintenance completion.
    const interval = window.setInterval(loadStatus, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/15 text-indigo-400">
          <Wrench size={38} />
        </div>

        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-indigo-400">
          iBUY Africa
        </p>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          We&apos;ll be back soon.
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-300">
          {message ||
            "We're currently improving iBUY Africa to give you a better shopping experience. Our marketplace will be back shortly."}
        </p>

        {expectedBackAt && (
          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            <Clock className="text-indigo-400" size={20} />
            <div className="text-left">
              <p className="text-xs text-slate-400">Estimated return</p>
              <p className="text-sm font-semibold">
                {new Date(expectedBackAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="mx-auto mt-10 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold transition hover:bg-indigo-500"
        >
          <RefreshCw size={17} />
          Check again
        </button>

        <p className="mt-12 text-xs text-slate-500">
          Thank you for your patience. iBUY is working to serve you better.
        </p>
      </div>
    </main>
  );
}