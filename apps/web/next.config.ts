import type { NextConfig } from "next";
import path from "node:path";
import { apiConfiguration } from "./config/api-url.mjs";
const { proxyBaseUrl } = apiConfiguration(process.env);
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  turbopack: { root: path.resolve(__dirname, "../..") },
  async rewrites() {
    return proxyBaseUrl ? [
      {
        source: "/api/v1/:path*",
        destination: `${proxyBaseUrl}/:path*`,
      },
    ] : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
