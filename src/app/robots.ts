
import type { MetadataRoute } from "next";

const BASE_URL = "https://www.ibuydeals.africa";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/seller/",
        "/dashboard/",
        "/account/",
        "/cart/",
        "/checkout/",
        "/orders/",
        "/order/",
        "/payment/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/api/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}