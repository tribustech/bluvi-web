import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { getCompetitionsByStatus, type CompetitionListItem } from '@/core/competitions';
import { getLake, getLakesIndex, getReviewsForLake, parseLakeCoordinates, type LakeDetail, type Review } from '@/core/lakes';
import { getCommunityVenueCatches, getCommunityVenueSection, type CommunityLakeSectionDTO } from '@/core/partide';
import { ApiError, isApiError } from '@/core/transport';
import { richTextToPlain } from '@/components/templates/T3';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { e2eFault, e2eLakeStub } from './e2e-faults';
import { lakeLocationLine } from './location';

/*
 * The lake page's reads — fish app/(app)/lakes/[lakeId].tsx: useLake (the page), plus the sections
 * that load after it (useCommunityVenueSection, useCommunityVenueCatchesInfinite for the photo
 * count, LakeCompetitionsSection's two lists, LakeReviewsPreview's latest two).
 *
 * All of them are public CMS GETs (auth 'none'): cached by Next under the CMS's own
 * CDN-Cache-Control and purged by its cache tags (lib/server/public-get.ts), so a lake page is
 * static until the CMS purges `lake-<id>` (reviews, edits) — the T3 data-loading contract:
 *  - the lake read is BOUNDED (READ_TIMEOUT_MS): a hung CMS ends in error.tsx with «Încearcă din
 *    nou», never in an endless skeleton; a 404 (or the 400 Strapi gives a malformed id) is
 *    `notFound()` (parity lakes.detail.c2);
 *  - the secondary reads start with it but are NOT awaited with it: each is settled and bounded
 *    (SECTION_TIMEOUT_MS) and handed to the page as a promise, so it streams behind its own
 *    Suspense and fails on its own (lakes.detail.c32);
 *  - a FAILED read never becomes static output: the part that renders it calls `dynamicOnFailure`
 *    (await connection()), so a failure met while prerendering (a build, a revalidation) leaves that
 *    part to be rendered per request instead of baking «A apărut o eroare» into the cached page —
 *    and «Încearcă din nou» (router.refresh) really reads again. Same for the lake itself: a failed
 *    lake read while prerendering makes that page on-demand, it never fails the build.
 */

const READ_TIMEOUT_MS = 8000;
const SECTION_TIMEOUT_MS = 4000;

export type Settled<T> = { ok: true; value: T } | { ok: false };

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ApiError({ message: `${what}: timeout`, status: 0, code: 'NETWORK', path: what })), ms);
  });
  return Promise.race([p, expired]).finally(() => clearTimeout(timer));
}

function settle<T>(lakeId: string, read: () => Promise<T>, what: string): Promise<Settled<T>> {
  return timeout(e2eFault(lakeId, what).then(read), SECTION_TIMEOUT_MS, what).then(
    value => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
}

export type LakeLoad = { kind: 'ok'; lake: LakeDetail } | { kind: 'missing' };

/** The lake (`/feed/lakes/:id`), one read per request for metadata + page (React `cache`). */
export const loadLake = cache(async (id: string): Promise<LakeLoad> => {
  const what = `/feed/lakes/${id}`;
  try {
    const lake = await timeout(
      e2eFault(id, 'lake').then(() => getLake(createServerTransport(), id)),
      READ_TIMEOUT_MS,
      what,
    );
    return { kind: 'ok', lake: e2eLakeStub(id, lake) };
  } catch (e) {
    if (isApiError(e) && (e.status === 404 || e.status === 400)) return { kind: 'missing' };
    // While prerendering this stops here and the page is rendered on demand (error.tsx then).
    await connection();
    throw e;
  }
});

/**
 * Awaits a settled section read; on failure, opts the calling Suspense subtree out of the
 * prerender (see the header) before the error is rendered.
 */
export async function dynamicOnFailure<T>(read: Promise<Settled<T>>): Promise<Settled<T>> {
  const settled = await read;
  if (!settled.ok) await connection();
  return settled;
}

/** fish LakeCompetitionsSection: the live and upcoming competitions of the lake, five each — two
 * reads that load and fail on their own (fish: one query, one error + retry per list, c24). */
export type LakeCompetitions = { live: Settled<CompetitionListItem[]>; upcoming: Settled<CompetitionListItem[]> };

/** fish LakeReviewsPreview: `useGetReviewsForLakeQuery(lakeId, 2)`. */
export const LATEST_REVIEWS = 2;

export type LakeSections = {
  /** /feed/community/lakes/:id — the Partide section (the browser polls it, lakes.detail.c21). */
  community: Promise<Settled<CommunityLakeSectionDTO>>;
  /** /feed/community/lakes/:id/catches total — the hero photo pill adds it (lakes.detail.c7). */
  catchesTotal: Promise<Settled<number>>;
  competitions: Promise<LakeCompetitions>;
  reviews: Promise<Settled<Review[]>>;
};

export function loadLakeSections(id: string): LakeSections {
  const t = createServerTransport();
  const venue = { kind: 'lake', id } as const;
  return {
    community: settle(id, () => getCommunityVenueSection(t, venue), 'community'),
    catchesTotal: settle(id, () => getCommunityVenueCatches(t, venue, { page: 1, pageSize: 1 }).then(r => r.meta.pagination.total), 'catches'),
    competitions: Promise.all([
      settle(id, () => getCompetitionsByStatus(t, 'started', { page: 1, pageSize: 5 }, id).then(r => r.data), 'competitions-live'),
      settle(id, () => getCompetitionsByStatus(t, 'notStarted', { page: 1, pageSize: 5 }, id).then(r => r.data), 'competitions-upcoming'),
    ]).then(([live, upcoming]) => ({ live, upcoming })),
    reviews: settle(id, () => getReviewsForLake(t, id, { page: 1, pageSize: LATEST_REVIEWS }).then(r => r.data.slice(0, LATEST_REVIEWS)), 'reviews'),
  };
}

/** Lakes to prerender: the whole public index (one cached read). Cache Components needs one param. */
export async function lakeIdsToPrerender(): Promise<string[]> {
  try {
    return (await getLakesIndex(createServerTransport())).map(l => l.documentId);
  } catch (e) {
    console.error('[balta] generateStaticParams: /feed/lakes/index failed', e);
    return [];
  }
}

/** Plain-text summary for the meta description / JSON-LD (≤ 160 characters). */
export function lakeSummary(lake: LakeDetail): string {
  const where = lakeLocationLine(lake);
  const intro = richTextToPlain(lake.description).replace(/^descriere:\s*/i, '');
  const base = intro || `Baltă de pescuit${where ? ` în ${where}` : ''}. Prețuri, facilități, recenzii, partide și concursuri pe Bluvi.`;
  return base.length > 160 ? `${base.slice(0, 157).trimEnd()}…` : base;
}

/** The lake's lead photo, the largest rendition the CMS has (OpenGraph, JSON-LD). */
export function lakeImage(lake: LakeDetail): string | null {
  const img = lake.images[0];
  return img ? img.url || img.mediumUrl || img.smallUrl || null : null;
}

/** schema.org: a fishing lake as a TouristAttraction (geo, address, rating). */
export function lakeJsonLd(lake: LakeDetail): Record<string, unknown> {
  const coords = parseLakeCoordinates(lake.coordinates);
  const image = lakeImage(lake);
  const meta = lake.reviewsMeta;
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: lake.name,
    description: lakeSummary(lake),
    url: absoluteUrl(routes.lake(lake.documentId)),
    touristType: 'Pescari',
    ...(image ? { image: [image] } : {}),
    ...(coords ? { geo: { '@type': 'GeoCoordinates', latitude: coords.lat, longitude: coords.lng } } : {}),
    ...(lake.address || lake.countyRef?.name
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(lake.address ? { streetAddress: lake.address } : {}),
            ...(lake.cityRef?.name ? { addressLocality: lake.cityRef.name } : {}),
            ...(lake.countyRef?.name ? { addressRegion: lake.countyRef.name } : {}),
            addressCountry: 'RO',
          },
        }
      : {}),
    ...(meta && meta.count > 0 && meta.overall
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: meta.overall, ratingCount: meta.count, bestRating: 5, worstRating: 1 } }
      : {}),
    ...(lake.website ? { sameAs: [lake.website] } : {}),
  };
}
