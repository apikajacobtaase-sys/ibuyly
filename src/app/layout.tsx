import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ClientLayout from "@/components/ClientLayout";
import { Toaster } from "sonner";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "iBUY Marketplace",
    template: "%s | iBUY",
  },
  description: "Shop from trusted sellers across Ghana.",
  applicationName: "iBUY",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "iBUY",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7931E",
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
  <Toaster
    position="top-center"
    richColors
    closeButton
    duration={3000}
  />
  <ClientLayout>{children}</ClientLayout>
</Providers>
      </body>
    </html>
  );
}
