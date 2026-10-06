import path from 'node:path';
import type { NextConfig } from 'next';
import pkg from './package.json';

/**
 * Only the real production site may be indexed. Every other deployment (staging, previews, the
 * pre-launch production target that still reads the staging CMS) sends `noindex` and a robots.txt
 * that blocks everything. Set SITE_INDEXABLE=1 on the launch deployment only.
 */
const siteIndexable = process.env.SITE_INDEXABLE === '1';

const nextConfig: NextConfig = {
  // Lets several dev servers run side by side (one per parallel workflow unit): NEXT_DIST_DIR=.next-3101.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The workspace root (fir-intins/) has its own lockfile; pin tracing to this app.
  outputFileTracingRoot: path.resolve(__dirname),
  // Public CMS reads go through `'use cache'` + cacheTag/cacheLife (lib/server/public-get.ts),
  // driven by the CMS's own CDN-Cache-Control / X-Cache-Tag headers.
  cacheComponents: true,
  // The floating dev badge covers the mobile tab bar in screenshots.
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  async headers() {
    return siteIndexable ? [] : [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
  images: {
    // `next dev` (16.3) hangs on WebP/AVIF responses from the image optimizer — every <Image>
    // stays blank in a browser. `next start` serves them fine (checked 2026-10-03), so only dev
    // skips optimization.
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      { protocol: 'https', hostname: 'fir-intins-strapi.s3.eu-central-1.amazonaws.com' },
      { protocol: 'https', hostname: 'bluvi-staging.s3.eu-central-1.amazonaws.com' },
    ],
  },
};

export default nextConfig;
