 import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating";

export interface ProductDiscoveryParams {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  productIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

interface ProductDiscoveryRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  createdAt: Date;

  price: number | null;
  originalPrice: number | null;
  discountPercent: number;

  stockQuantity: number;
  bestOfferId: string | null;
  bestVariantId: string | null;

  imageUrl: string | null;

  sellerName: string;
  sellerId: string;
  sellerLogoUrl: string | null;

  categoryId: string;
  categoryName: string;
  categorySlug: string;

  avgRating: number;
  reviewCount: number;
}

export async function discoverProducts(
  params: ProductDiscoveryParams = {}
) {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(params.limit ?? 20))
  );

  const skip = (page - 1) * limit;

  const query = params.query?.trim();
  const categoryId = params.categoryId?.trim();
  const categorySlug = params.categorySlug?.trim();
  const productIds = params.productIds
  ? [...new Set(
      params.productIds
        .filter((id) => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    )]
  : undefined;

  const minPrice =
    typeof params.minPrice === "number" &&
    Number.isFinite(params.minPrice)
      ? params.minPrice
      : undefined;

  const maxPrice =
    typeof params.maxPrice === "number" &&
    Number.isFinite(params.maxPrice)
      ? params.maxPrice
      : undefined;

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    throw new Error("Minimum price cannot exceed maximum price.");
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.status = 'ACTIVE'`,
  ];
if (productIds !== undefined) {
  if (productIds.length === 0) {
    conditions.push(Prisma.sql`FALSE`);
  } else {
    conditions.push(
      Prisma.sql`p.id IN (${Prisma.join(productIds)})`
    );
  }
}
  if (query) {
    const searchTerm = `%${query}%`;

    conditions.push(
      Prisma.sql`(
        p.title ILIKE ${searchTerm}
        OR p.description ILIKE ${searchTerm}
      )`
    );
  }

  if (categoryId) {
    conditions.push(
      Prisma.sql`p.category_id = ${categoryId}`
    );
  } else if (categorySlug) {
    conditions.push(
      Prisma.sql`c.slug = ${categorySlug}`
    );
  }

  if (minPrice !== undefined) {
    conditions.push(
      Prisma.sql`bo.best_price >= ${minPrice}`
    );
  }

  if (maxPrice !== undefined) {
    conditions.push(
      Prisma.sql`bo.best_price <= ${maxPrice}`
    );
  }

  // Price filters should never include products without a valid offer.
  if (minPrice !== undefined || maxPrice !== undefined) {
    conditions.push(
      Prisma.sql`bo.best_price IS NOT NULL`
    );
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const offerCTE = Prisma.sql`
    WITH ranked_offers AS (
      SELECT
        pv.product_id,
        pv.id AS variant_id,
        pv.compare_at_price,
        so.id AS offer_id,
        so.price,
        so.stock_quantity,
        sp.id AS seller_id,
        sp.business_name,
        sp.logo_url,
        ROW_NUMBER() OVER (
          PARTITION BY pv.product_id
          ORDER BY
            so.price ASC,
            so.created_at ASC,
            so.id ASC
        ) AS offer_rank

      FROM product_variants pv

      INNER JOIN seller_offers so
        ON so.variant_id = pv.id

      INNER JOIN seller_profiles sp
        ON sp.id = so.seller_id

      WHERE
        pv.is_active = TRUE
        AND so.status = 'ACTIVE'
        AND so.stock_quantity > 0
        AND sp.is_active = TRUE
    ),

    best_offers AS (
      SELECT
        product_id,
        variant_id,
        compare_at_price,
        offer_id,
        price AS best_price,
        stock_quantity,
        seller_id,
        business_name,
        logo_url
      FROM ranked_offers
      WHERE offer_rank = 1
    )
  `;

  const orderBy = (() => {
    switch (params.sort) {
      case "price_asc":
        return Prisma.sql`
          bo.best_price ASC NULLS LAST,
          p.created_at DESC
        `;

      case "price_desc":
        return Prisma.sql`
          bo.best_price DESC NULLS LAST,
          p.created_at DESC
        `;

      case "rating":
        return Prisma.sql`
          COALESCE(rs.avg_rating, 0) DESC,
          COALESCE(rs.review_count, 0) DESC,
          p.created_at DESC
        `;

      case "newest":
      default:
        return Prisma.sql`p.created_at DESC`;
    }
  })();

  const [rows, countResult] = await Promise.all([
    db.$queryRaw<ProductDiscoveryRow[]>(Prisma.sql`
      ${offerCTE},

      review_stats AS (
        SELECT
          product_id,
          AVG(rating)::FLOAT AS avg_rating,
          COUNT(*)::INT AS review_count
        FROM reviews
        GROUP BY product_id
      )

      SELECT
        p.id,
        p.title,
        p.slug,
        p.description,
        p.created_at AS "createdAt",

        bo.best_price AS price,
        bo.compare_at_price AS "originalPrice",
        bo.stock_quantity AS "stockQuantity",
        bo.offer_id AS "bestOfferId",
        bo.variant_id AS "bestVariantId",

        COALESCE(
          primary_image.url,
          (
            SELECT pi.url
            FROM product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.sort_order ASC
            LIMIT 1
          )
        ) AS "imageUrl",

        COALESCE(
          bo.business_name,
          ps.business_name,
          'iBUY Marketplace'
        ) AS "sellerName",

        COALESCE(
          bo.seller_id,
          ps.id,
          'unknown'
        ) AS "sellerId",

        COALESCE(
          bo.logo_url,
          ps.logo_url
        ) AS "sellerLogoUrl",

        c.id AS "categoryId",
        c.name AS "categoryName",
        c.slug AS "categorySlug",

        COALESCE(rs.avg_rating, 0)::FLOAT AS "avgRating",
        COALESCE(rs.review_count, 0)::INT AS "reviewCount"

      FROM products p

      INNER JOIN categories c
        ON c.id = p.category_id

      LEFT JOIN best_offers bo
        ON bo.product_id = p.id

      LEFT JOIN seller_profiles ps
        ON ps.id = p.seller_id
        AND ps.is_active = TRUE

      LEFT JOIN review_stats rs
        ON rs.product_id = p.id

      LEFT JOIN LATERAL (
        SELECT pi.url
        FROM product_images pi
        WHERE
          pi.product_id = p.id
          AND pi.is_primary = TRUE
        ORDER BY pi.sort_order ASC
        LIMIT 1
      ) primary_image ON TRUE

      WHERE ${whereClause}

      ORDER BY ${orderBy}

      LIMIT ${limit}
      OFFSET ${skip}
    `),

    db.$queryRaw<{ total: number }[]>(Prisma.sql`
      ${offerCTE}

      SELECT COUNT(*)::INT AS total

      FROM products p

      INNER JOIN categories c
        ON c.id = p.category_id

      LEFT JOIN best_offers bo
        ON bo.product_id = p.id

      WHERE ${whereClause}
    `),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  const products = rows.map((product) => {
    const price =
      product.price === null
        ? null
        : Number(product.price);

    const originalPrice =
      product.originalPrice === null
        ? null
        : Number(product.originalPrice);

    const discountPercent =
      price !== null &&
      originalPrice !== null &&
      originalPrice > price
        ? Math.round(
            ((originalPrice - price) / originalPrice) * 100
          )
        : 0;

    return {
      id: product.id,
      title: product.title || "Untitled Product",
      slug: product.slug || "",
      description: product.description,

      price,
      originalPrice,
      discountPercent,

      stockQuantity: Number(product.stockQuantity ?? 0),
      bestOfferId: product.bestOfferId,
      bestVariantId: product.bestVariantId,

      imageUrl: product.imageUrl,

      sellerName: product.sellerName,
      sellerId: product.sellerId,
      sellerLogoUrl: product.sellerLogoUrl,

      categoryId: product.categoryId,
      categoryName: product.categoryName,
      categorySlug: product.categorySlug,

      category: {
        id: product.categoryId,
        name: product.categoryName,
        slug: product.categorySlug,
      },

      avgRating: Number(product.avgRating ?? 0),
      reviewCount: Number(product.reviewCount ?? 0),

      // Compatibility with existing customer components.
      rating: Number(product.avgRating ?? 0),
      soldCount: 0,

      inStock: Boolean(product.bestOfferId),
    };
  });

  return {
    products,
    total,
    page,
    limit,
    hasMore: total > skip + limit,
  };
}