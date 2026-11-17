import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ClientLayout from "@/components/ClientLayout";
import { Toaster } from "sonner";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ibuydeals.africa"),

title: {
  default: "iBUY Africa | Online Shopping Marketplace in Ghana",
  template: "%s | iBUY Africa",
},

  description:
    "Discover products, compare prices and shop from sellers across Ghana on iBUY.",

 applicationName: "iBUY Africa",

  openGraph: {
    type: "website",
    siteName: "iBUY Africa",
    locale: "en_GH",
    title: "iBUY Africa | Online Shopping Marketplace in Ghana",
    description:
      "Discover products, compare prices and shop from sellers across Ghana on iBUY Africa.",
    url: "https://www.ibuydeals.africa",
  },

  twitter: {
    card: "summary_large_image",
    title: "iBUY Africa | Online Shopping Marketplace in Ghana",
    description:
      "Discover products, compare prices and shop from sellers across Ghana on iBUY Africa.",
  },

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "iBUY Africa",
    statusBarStyle: "default",
  },
icons: {
  icon: [
    { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
    { url: "/brand/ibuy-africa-icon-192.png", sizes: "192x192", type: "image/png" },
    { url: "/brand/ibuy-africa-icon-512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [
    { url: "/brand/ibuy-africa-icon-192.png", sizes: "192x192", type: "image/png" },
  ],
},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#014900",
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
