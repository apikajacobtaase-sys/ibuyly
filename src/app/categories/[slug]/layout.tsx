 import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      isActive: true,
    },
  });

  if (!category) {
    return {
      title: "Category Not Found",
      robots: { index: false, follow: true },
    };
  }

  const title = `Shop ${category.name} in Ghana`;
  const description = `Discover and shop ${category.name} products from trusted sellers across Ghana on iBUY. Compare products and find great deals.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${category.slug}`,
    },
    robots: {
      index: category.isActive,
      follow: true,
    },
    openGraph: {
      type: "website",
      title: `${title} | iBUY`,
      description,
      url: `/categories/${category.slug}`,
      siteName: "iBUY",
    },
    twitter: {
      card: "summary",
      title: `${title} | iBUY`,
      description,
    },
  };
}

export default function CategoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}