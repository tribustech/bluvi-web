import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  // Public CMS reads go through `'use cache'` + cacheTag/cacheLife (lib/server/public-get.ts),
  // driven by the CMS's own CDN-Cache-Control / X-Cache-Tag headers.
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fir-intins-strapi.s3.eu-central-1.amazonaws.com' },
      { protocol: 'https', hostname: 'bluvi-staging.s3.eu-central-1.amazonaws.com' },
    ],
  },
};

export default nextConfig;
