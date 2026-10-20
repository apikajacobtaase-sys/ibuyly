// src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";

// 👇 This MUST be a named export (using the word `export function`)
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}