import 'server-only';
import { getFilteredLakes, getLakeLocationSubtitle, getLakeMapClusters, type LakeMapLakeNode } from '@/core/lakes';
import type { Transport, TransportRequest } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';

/**
 * The lakes the T2 demo shows, from the local CMS through core/:
 * - pins: /lakes/map-clusters over Romania at a zoom where the server returns every lake as its own
 *   node (coordinates, photos, rating, prices) — and once more with `bookable` for «Rezervări»;
 * - species + facilities: /feed/lakes/filtered (the card DTO), joined by documentId.
 *
 * The production screen (/balti/harta, M1) asks for clusters per viewport and the list from
 * /lakes/in-bbox (fish). The local CMS has no Public grant on in-bbox (403, ROADMAP §8), so the
 * demo loads the full set once and does viewport, clustering and filters in the browser.
 */
export type DemoLake = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  location: string;
  /** «C&R», «Retinere», «C&R + Retinere». */
  regime: string | null;
  rating: number | null;
  reviewsCount: number;
  priceMin: number | null;
  priceMax: number | null;
  /** Up to 3 photo URLs (medium format), first = card photo. */
  photos: string[];
  species: string[];
  facilities: string[];
  bookable: boolean;
};

/**
 * A CMS read slower than this fails (state «error» with «Reîncearcă») instead of holding the
 * loading skeleton forever.
 */
const CMS_TIMEOUT_MS = 8_000;

/**
 * Every request gets an upper bound. The signal aborts what can be aborted; the race also bounds the
 * cached public GET (lib/server/public-get.ts), which runs inside 'use cache' and takes no signal.
 */
function withTimeout(t: Transport, ms: number): Transport {
  return {
    request<T>(req: TransportRequest) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`CMS ${req.path}: no answer in ${ms} ms`)), ms);
      });
      return Promise.race([t.request<T>({ ...req, signal: req.signal ?? AbortSignal.timeout(ms) }), timeout]).finally(() =>
        clearTimeout(timer),
      );
    },
  };
}

const ROMANIA = { north: 48.6, south: 43.4, east: 30.2, west: 20 };
/** Past the server's cluster max zoom every lake comes back as its own node. */
const ALL_LAKES_ZOOM = 20;

function photoOf(img: LakeMapLakeNode['images'][number]): string {
  return img.formats?.medium?.url ?? img.url;
}

/**
 * What the demo got. The pins are the page; booking and the card read (species, facilities) only
 * enrich them — when one of those reads fails its flag is false, and the page says that part is
 * unavailable instead of answering as if no lake had it.
 */
export type DemoLakesResult = {
  lakes: DemoLake[];
  /** The `bookable` read answered: «Rezervări» can filter. */
  bookingKnown: boolean;
  /** Every page of /feed/lakes/filtered answered: species and facilities are complete. */
  cardsKnown: boolean;
};

/** /feed/lakes/filtered page size; the read follows `pagination.pageCount` past it. */
const CARDS_PAGE_SIZE = 100;

async function getAllLakeCards(t: Transport) {
  const first = await getFilteredLakes(t, { page: 1, pageSize: CARDS_PAGE_SIZE });
  const pageCount = first.meta.pagination.pageCount;
  if (pageCount <= 1) return first.data;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => getFilteredLakes(t, { page: i + 2, pageSize: CARDS_PAGE_SIZE })),
  );
  return [first, ...rest].flatMap((p) => p.data);
}

export async function loadDemoLakes(): Promise<DemoLakesResult> {
  const t = withTimeout(createServerTransport(), CMS_TIMEOUT_MS);
  // The pins are the page; booking and the species / facilities cards only enrich them, so a
  // failure there degrades (not bookable, no species / facilities) instead of failing the page.
  const [allResult, bookableResult, cardsResult] = await Promise.allSettled([
    getLakeMapClusters(t, { ...ROMANIA, zoom: ALL_LAKES_ZOOM }),
    getLakeMapClusters(t, {
      ...ROMANIA,
      zoom: ALL_LAKES_ZOOM,
      filters: { selectedFish: [], selectedRegimes: [], selectedFacilities: [], ratingTier: null, bookableOnly: true },
    }),
    getAllLakeCards(t),
  ]);
  if (allResult.status === 'rejected') throw allResult.reason;
  const all = allResult.value;
  for (const r of [bookableResult, cardsResult]) {
    if (r.status === 'rejected') console.warn('[dev/templates/t2] enrichment read failed, showing pins without it', r.reason);
  }
  const bookableIds = new Set(
    bookableResult.status === 'fulfilled' ? bookableResult.value.data.flatMap((n) => (n.type === 'lake' ? [n.documentId] : [])) : [],
  );
  const cardById = new Map(cardsResult.status === 'fulfilled' ? cardsResult.value.map((c) => [c.documentId, c]) : []);

  const lakes = all.data
    .flatMap((n) => (n.type === 'lake' ? [n] : []))
    .map((n): DemoLake => {
      const card = cardById.get(n.documentId);
      const reviews = n.reviewsMeta && n.reviewsMeta.count > 0 ? n.reviewsMeta : null;
      return {
        id: n.documentId,
        lat: n.coordinate.latitude,
        lng: n.coordinate.longitude,
        name: n.name,
        location: getLakeLocationSubtitle(n, { includeAddress: false }) ?? '',
        regime: n.regime,
        rating: reviews ? (reviews.overall ?? null) : null,
        reviewsCount: reviews?.count ?? 0,
        priceMin: n.priceMin ?? null,
        priceMax: n.priceMax ?? null,
        photos: n.images.slice(0, 3).map(photoOf),
        species: card?.fishSpecies.map((s) => s.fish.Name) ?? [],
        facilities: card?.facility.map((f) => f.name) ?? [],
        bookable: bookableIds.has(n.documentId),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  return { lakes, bookingKnown: bookableResult.status === 'fulfilled', cardsKnown: cardsResult.status === 'fulfilled' };
}
