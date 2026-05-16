import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bluvi-staging.s3.eu-central-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "fir-intins-strapi.s3.eu-central-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
