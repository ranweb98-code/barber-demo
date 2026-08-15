import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { swManifestTransform } from "./scripts/sw-manifest-transform.mjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  manifestTransforms: [swManifestTransform],
});

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "web-push",
  ],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
