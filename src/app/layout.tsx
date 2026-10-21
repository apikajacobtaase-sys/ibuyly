 // src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ClientLayout from "@/components/ClientLayout"; // ✅ Import the client wrapper

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iBUY Marketplace",
  description: "Ghana's premier multi-vendor e-commerce platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
    <body className={`${inter.className} bg-white text-gray-900`}>
        <Providers>
          {/* ✅ Wrap everything in the Client Layout */}
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}