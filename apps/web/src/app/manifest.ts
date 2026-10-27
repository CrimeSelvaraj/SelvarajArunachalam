import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATOZ",
    short_name: "ATOZ",
    description: "The whole alphabet of making, on one bench.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ecdf",
    theme_color: "#1c1612",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
