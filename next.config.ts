import path from 'node:path';
import type { NextConfig } from 'next';
import pkg from './package.json';
import { POLLS_PAST_ON_WEB } from './app/(site)/sondaje/_components/model';

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
    /*
     * fish's legacy paths (global.b.legacy-path-redirects): every URL the app has shared
     * (WEB_DOMAIN links, universal links on /competitions/*, /lakes/*, /polls/*, /partide/*) or a push
     * can target (helpers/getRedirectLocationForNotification.ts:30-193) → the web's Romanian route,
     * permanent (308). Specific before generic: Next takes the first match. Next merges the request's
     * query into every redirect destination (the destination's own keys win), so fish's leftovers
     * (timestamp, activeTabId, participantsFilter, sectorName, standName, name) ride along and the
     * pages ignore them; a next.config redirect cannot drop a key. Unknown ids land on the
     * destination's not-found page. Proposal for the canonical scheme: docs/reviews/M8-url-scheme.md.
     */
    const tab = (value: string) => [{ type: 'query' as const, key: 'activeTabId', value }];
    const legacy = [
      // COMPETITION_WEIGHING_MODIFIED / _END: ?openWeighingSheet=1&standId&weighingId → the weighing
      // dialog over Cântare (WeighingsView reads `cantar` + `stand`, lib/routes competitionWeighing). A
      // value-less `has` item hands its value to the destination as :key.
      {
        source: '/competitions/:id',
        has: [
          { type: 'query' as const, key: 'openWeighingSheet', value: '1' },
          { type: 'query' as const, key: 'standId' },
          { type: 'query' as const, key: 'weighingId' },
        ],
        destination: '/concursuri/:id/cantare?cantar=:weighingId&stand=:standId',
        permanent: true,
      },
      // ?activeTabId= (common/utils/competitionRoutes.ts) → the tab's own page.
      {
        source: '/competitions/:id',
        has: [...tab('participanti'), { type: 'query' as const, key: 'participantsFilter', value: 'pending' }],
        destination: '/concursuri/:id/participanti?filtru=in-asteptare',
        permanent: true,
      },
      { source: '/competitions/:id', has: tab('participanti'), destination: '/concursuri/:id/participanti', permanent: true },
      { source: '/competitions/:id', has: tab('clasament'), destination: '/concursuri/:id/clasament', permanent: true },
      { source: '/competitions/:id', has: tab('extracantare'), destination: '/concursuri/:id/extra-cantare', permanent: true },
      { source: '/competitions/:id', has: tab('informatii'), destination: '/concursuri/:id/informatii', permanent: true },
      { source: '/competitions/:id', has: tab('regulament'), destination: '/concursuri/:id/regulament', permanent: true },
      // CHAT_MESSAGE ?tab=participants|general → the web chat's `tab` (participanti|general; the page
      // also reads fish's «participants», lastTab.ts roomFromParam).
      {
        source: '/competitions/:id/chat',
        has: [{ type: 'query' as const, key: 'tab', value: 'participants' }],
        destination: '/concursuri/:id/chat?tab=participanti',
        permanent: true,
      },
      { source: '/competitions/:id/chat', destination: '/concursuri/:id/chat', permanent: true },
      { source: '/competitions/:id', destination: '/concursuri/:id', permanent: true },
      { source: '/competitions', destination: '/concursuri', permanent: true },
      // fish's in-app stand timeline (competitions/stand-timeline/[competitionId]); before the
      // generic /competitions/:id rules — they only match one segment, the order keeps intent explicit.
      { source: '/competitions/stand-timeline/:id', destination: '/concursuri/:id/statistici/cronologie', permanent: true },
      // Lakes (ShareLakeSheet, FOLLOW_LAKE_REVIEW, NEW_LAKES; lakes.b.share-link) and every fish
      // lakes/[lakeId]/* sub-screen + lakes/review/[lakeId] (AASA covers /lakes/*): each has a web page.
      { source: '/lakes/review/:id', destination: '/balti/:id/recenzie', permanent: true },
      { source: '/lakes/:id/reviews', destination: '/balti/:id/recenzii', permanent: true },
      { source: '/lakes/:id/gallery', destination: '/balti/:id/galerie', permanent: true },
      { source: '/lakes/:id/map', destination: '/balti/:id/harta', permanent: true },
      {
        source: '/lakes/:id/:section(capturi|concursuri|partide|standuri|statistici|clasament)',
        destination: '/balti/:id/:section',
        permanent: true,
      },
      { source: '/lakes/:id', destination: '/balti/:id', permanent: true },
      { source: '/lakes', destination: '/balti', permanent: true },
      // NEWS, COMPETITION_AUTO_CANCELLED_ORGANIZER, PENALTY.
      { source: '/news/:id', destination: '/stiri/:id', permanent: true },
      { source: '/news', destination: '/stiri', permanent: true },
      { source: '/organizer', destination: '/organizator', permanent: true },
      { source: '/penalties/:competitionId/apply', destination: '/concursuri/:competitionId/penalizari/aplica', permanent: true },
      { source: '/penalties/:competitionId/select-stand', destination: '/concursuri/:competitionId/penalizari/stand', permanent: true },
      { source: '/penalties/:competitionId', destination: '/concursuri/:competitionId/penalizari', permanent: true },
      // BOOKING_*_OPERATOR ?status=pending|rejected|cancelled — the inbox reads the same `status`.
      { source: '/operator/:lakeId/bookings', destination: '/operator/:lakeId/rezervari', permanent: true },
      // FOLLOW_RECORD_PERSONAL / _LAKE → the partidă's catches; before /partide/comunitate/:id below,
      // which would otherwise read «capturi» as a partidă id (it only matches one segment, but the
      // order keeps the intent explicit).
      { source: '/partide/comunitate/capturi/:id', destination: '/partide/:id/capturi', permanent: true },
      // fish partide/comunitate/galerie/[id] → the partidă's gallery.
      { source: '/partide/comunitate/galerie/:id', destination: '/partide/:id/galerie', permanent: true },
    ];
    return [
      ...legacy,
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
      // partidaJoinDeepLink, fish CoopCard) and the start / join links (lib/app-links.ts): joining
      // and starting a partidă are app-only on web (owner 2026-10-08, ROADMAP §4b rule 21), so where
      // the link lands on the web (no app) it opens the Partide hub, whose hero hands over to the
      // app (partide.b.deep-link-join). Temporary: the universal-link plan is M8's.
      { source: '/partide/join/:code', destination: '/partide', permanent: false },
      { source: '/partide/join', destination: '/partide', permanent: false },
      { source: '/partide/start', destination: '/partide', permanent: false },
      // fish's poll links https://bluvi-app.wearetribus.com/polls/current (helpers/sharePoll.ts) and
      // /polls/past (universal links cover /polls/*) → the web's poll pages (participant.b.poll-deeplink).
      // Until /sondaje/anterioare ships (POLLS_PAST_ON_WEB), /polls/past goes to the current poll with
      // a temporary redirect, so no browser caches a 308 to a page that does not exist yet.
      { source: '/polls/current', destination: '/sondaje', permanent: true },
      POLLS_PAST_ON_WEB
        ? { source: '/polls/past', destination: '/sondaje/anterioare', permanent: true }
        : { source: '/polls/past', destination: '/sondaje', permanent: false },
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
