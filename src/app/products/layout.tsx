 import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop All Products in Ghana",
  description:
    "Explore and compare products from trusted sellers across Ghana. Discover great deals on iBUY.",
  alternates: {
    canonical: "/products",
  },
  openGraph: {
    type: "website",
    title: "Shop All Products in Ghana | iBUY",
    description:
      "Explore and compare products from trusted sellers across Ghana.",
    url: "/products",
    siteName: "iBUY",
  },
  twitter: {
    card: "summary",
    title: "Shop All Products in Ghana | iBUY",
    description:
      "Explore products and discover great deals from sellers across Ghana.",
  },
};

export default function ProductsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
