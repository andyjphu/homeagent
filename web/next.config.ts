import type { NextConfig } from "next";
import path from "path";

const OLD_ROUTES = [
  "/dashboard",
  "/leads",
  "/deals",
  "/buyers",
  "/properties",
  "/calls",
  "/email",
  "/settings",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      // Exact old routes
      ...OLD_ROUTES.map((source) => ({
        source,
        destination: "/app/clients",
        permanent: false,
      })),
      // Dynamic old routes (e.g. /leads/[id], /deals/[id])
      ...OLD_ROUTES.map((source) => ({
        source: `${source}/:path*`,
        destination: "/app/clients",
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
