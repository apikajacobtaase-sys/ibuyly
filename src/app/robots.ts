 import type { MetadataRoute } from "next";

const BASE_URL = "https://www.ibuydeals.africa";

const privatePaths = [
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
];

const aiBots = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/search"],
        disallow: privatePaths,
      },
      ...aiBots.map((bot) => ({
        userAgent: bot,
        allow: ["/", "/products/", "/categories/"],
        disallow: privatePaths,
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}