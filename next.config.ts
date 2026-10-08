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
  async redirects() {
    return [
      // fish's /anglers/* paths (NEW_FOLLOWER links, shared links; parity account.b.deep-link-angler)
      // → the web's Romanian ones. The specific ones first: the generic rule would read «suggested»
      // as an angler id.
      { source: '/anglers/suggested', destination: '/pescari/sugerati', permanent: true },
      // fish connections?tab=followers|following → conexiuni?tab=urmaritori|urmareste (a bare or
      // unknown tab opens the default tab).
      {
        source: '/anglers/:id/connections',
        has: [{ type: 'query', key: 'tab', value: 'followers' }],
        destination: '/pescari/:id/conexiuni?tab=urmaritori',
        permanent: true,
      },
      {
        source: '/anglers/:id/connections',
        has: [{ type: 'query', key: 'tab', value: 'following' }],
        destination: '/pescari/:id/conexiuni?tab=urmareste',
        permanent: true,
      },
      { source: '/anglers/:id/connections', destination: '/pescari/:id/conexiuni', permanent: true },
      { source: '/anglers/:id', destination: '/pescari/:id', permanent: true },
      // fish's /bookings paths (BOOKING_*_ANGLER links; global.b.deep-link-scheme) → Rezervările mele
      // and the booking page (booking.rezervare.c14).
      { source: '/bookings', destination: '/rezervari', permanent: true },
      { source: '/bookings/:id', destination: '/rezervari/:id', permanent: true },
      // fish's spectator share link https://bluvi-app.wearetribus.com/partide/comunitate/{documentId}
      // (features/partide/helpers/deepLinks.ts) → the web's partidă page, member or spectator view
      // on one URL (partide.b.deep-link-spectate).
      { source: '/partide/comunitate/:id', destination: '/partide/:id', permanent: true },
      // fish's invite link https://bluvi-app.wearetribus.com/partide/join/{code} (core
      // partidaJoinDeepLink, fish CoopCard) → the web's join-with-code page, which asks first and
      // sends a signed-out visitor to sign-in and back (partide.b.deep-link-join).
      { source: '/partide/join/:code', destination: '/partide/intra/:code', permanent: true },
    ];
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
