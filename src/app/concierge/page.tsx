 import { Suspense } from "react";
import ConciergeClient from "./ConciergeClient";

export default function ConciergePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading Concierge...
        </div>
      }
    >
      <ConciergeClient />
    </Suspense>
  );
}