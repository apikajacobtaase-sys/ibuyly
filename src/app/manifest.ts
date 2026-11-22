import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Inclusive Business Universe for You (iBUY Africa)",
    short_name: "iBUY Africa",
    description:
      "iBUY Africa — Inclusive Business Universe for You. Discover products, find businesses, compare prices and shop across Ghana and Africa.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#FFFFFF",
    theme_color: "#014900",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/brand/ibuy-africa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/ibuy-africa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}