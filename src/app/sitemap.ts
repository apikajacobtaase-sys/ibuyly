
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = "https://www.ibuydeals.africa";
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const [categories, products] = await Promise.all([
  db.category.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  }),
  db.product.findMany({
    where: { status: "ACTIVE" },
    select: { slug: true, updatedAt: true },
  }),
]).catch((error) => {
  console.error("SITEMAP_PRISMA_ERROR:", {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    meta: error?.meta,
    stack: error?.stack,
  });
  throw error;
});

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/products`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/categories`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...categories.map((category) => ({
      url: `${BASE_URL}/categories/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${BASE_URL}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}