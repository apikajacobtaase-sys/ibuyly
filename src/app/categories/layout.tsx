 import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop by Category in Ghana",
  description:
    "Browse iBUY product categories to discover electronics, fashion, home essentials and more from trusted sellers across Ghana.",
  alternates: {
    canonical: "/categories",
  },
  openGraph: {
    type: "website",
    title: "Shop by Category in Ghana | iBUY",
    description:
      "Explore product categories and discover great deals from trusted Ghanaian sellers.",
    url: "/categories",
    siteName: "iBUY",
  },
  twitter: {
    card: "summary",
    title: "Shop by Category in Ghana | iBUY",
    description:
      "Explore product categories and discover great deals on iBUY.",
  },
};

export default function CategoriesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}