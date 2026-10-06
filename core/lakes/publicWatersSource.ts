import * as z from 'zod';
import { queryOptions } from '../shared';
import type {
  PublicWaterDetail,
  PublicWaterGeometry,
  PublicWaterListItem,
  PublicWaterType,
} from './domain/publicWaters';

/*
 * The public-waters data source — the web equivalent of fish `features/public-waters/queries.ts`.
 *
 * fish reads the waters from a BUNDLED read-only SQLite DB (assets/db/public-waters.sqlite3,
 * DB_VERSION 4, ANAR «Hidrografie», CC-BY 4.0). There is no CMS endpoint for them, so the web
 * serves the SAME file (same ids, linkCodes, names without diacritics, attribution) from its own
 * server: a `PublicWatersSource` is implemented over that DB on the server (Server Components read
 * it directly) and over the web's own JSON routes in the browser (`createHttpPublicWatersSource`,
 * every answer validated with the schemas below). Same function names and semantics as fish.
 */

export interface LatLngBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** fish `PublicWaterViewportRow`: metadata + bbox spans, NO geometry. */
export type PublicWaterViewportRow = PublicWaterListItem & { bboxSpanLat: number; bboxSpanLng: number };

/** fish `PublicWaterMarker`: centroid row for the clusters band's list — geometry-free. */
export interface PublicWaterMarker {
  id: number;
  name: string | null;
  type: PublicWaterType;
  county: string | null;
  countyIds: number[];
  centerLat: number;
  centerLng: number;
  linkCode: string | null;
  areaKm2: number | null;
}

export interface PublicWaterCounty {
  id: number;
  name: string | null;
  abbreviation: string | null;
  fishingWatersCount: number;
}

/** One water centroid for the in-memory cluster index (fish clusterIndex `getAllCentroids`). */
export interface PublicWaterCentroid {
  id: number;
  type: PublicWaterType;
  countyId: number | null;
  lat: number;
  lng: number;
}

export interface ViewportOptions {
  types?: PublicWaterType[];
  /** Primary county ids; empty / undefined = all counties. */
  counties?: number[];
  minSpanDeg?: number;
  limit?: number;
}

/** Everything the public-water screens read (fish queries.ts, one function each). */
export interface PublicWatersSource {
  getWaterRowsInViewport(bounds: LatLngBounds, options?: ViewportOptions): Promise<PublicWaterViewportRow[]>;
  getGeometriesByIds(ids: number[]): Promise<{ id: number; geometry: PublicWaterGeometry }[]>;
  getMarkerWatersInViewport(
    bounds: LatLngBounds,
    options?: { types?: PublicWaterType[]; counties?: number[]; limit?: number },
  ): Promise<PublicWaterMarker[]>;
  getPublicWaterById(id: number): Promise<PublicWaterDetail | null>;
  getPublicWaterByLinkCode(code: string): Promise<PublicWaterDetail | null>;
  searchPublicWaters(term: string, limit?: number): Promise<PublicWaterListItem[]>;
  nearestWatersTo(lat: number, lng: number, limit?: number): Promise<PublicWaterListItem[]>;
  getCountyNamesByIds(ids: number[]): Promise<string[]>;
  getCounties(): Promise<PublicWaterCounty[]>;
  getAttribution(): Promise<string | null>;
  getAllCentroids(): Promise<PublicWaterCentroid[]>;
}

// ── wire schemas (the web's own JSON routes) ────────────────────────────────────────────────

export const publicWaterTypeSchema = z.enum(['river', 'natural_lake', 'reservoir_lake', 'coastal_lake', 'transitional_lake']);

const pair = z.tuple([z.number(), z.number()]);
export const publicWaterGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LineString'), coordinates: z.array(pair) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(pair)) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(pair)) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(z.array(pair))) }),
]);

export const publicWaterListItemSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  type: publicWaterTypeSchema,
  county: z.string().nullable(),
  countyId: z.number().nullable(),
  countyIds: z.array(z.number()),
  centerLat: z.number(),
  centerLng: z.number(),
  linkCode: z.string().nullable(),
  areaKm2: z.number().nullable(),
});

export const publicWaterViewportRowSchema = publicWaterListItemSchema.extend({ bboxSpanLat: z.number(), bboxSpanLng: z.number() });

export const publicWaterMarkerSchema = publicWaterListItemSchema.omit({ countyId: true });

export const publicWaterDetailSchema = publicWaterListItemSchema.extend({
  geometry: publicWaterGeometrySchema,
  nameEn: z.string().nullable(),
  euCode: z.string().nullable(),
  anarCode: z.string().nullable(),
  basin: z.string().nullable(),
  volumeMilM3: z.number().nullable(),
  elevationM: z.number().nullable(),
  source: z.string(),
});

export const publicWaterCountySchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  abbreviation: z.string().nullable(),
  fishingWatersCount: z.number(),
});

/** Centroids travel as compact tuples: [id, type index, countyId | -1, lat, lng]. */
export const PUBLIC_WATER_TYPES: readonly PublicWaterType[] = publicWaterTypeSchema.options;
export const publicWaterCentroidsSchema = z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]));

export function encodeCentroids(rows: PublicWaterCentroid[]): z.infer<typeof publicWaterCentroidsSchema> {
  // 1e-5° ≈ 1 m: plenty for a cluster centroid, and the payload drops by a third.
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return rows.map((r) => [r.id, PUBLIC_WATER_TYPES.indexOf(r.type), r.countyId ?? -1, round(r.lat), round(r.lng)]);
}

export function decodeCentroids(rows: z.infer<typeof publicWaterCentroidsSchema>): PublicWaterCentroid[] {
  return rows.flatMap(([id, t, county, lat, lng]) => {
    const type = PUBLIC_WATER_TYPES[t];
    return type ? [{ id, type, countyId: county < 0 ? null : county, lat, lng }] : [];
  });
}

// ── HTTP source (browser) ───────────────────────────────────────────────────────────────────

/** Reads one of the web's public-water JSON routes: `path` under the routes' base, plain query. */
export type PublicWatersGet = (path: string, query?: Record<string, string | number | undefined>) => Promise<unknown>;

const boundsQuery = (b: LatLngBounds) => ({ minLat: b.minLat, minLng: b.minLng, maxLat: b.maxLat, maxLng: b.maxLng });
const listQuery = (xs: ReadonlyArray<string | number> | undefined) => (xs && xs.length ? xs.join(',') : undefined);

/**
 * The source over the web's JSON routes (`app/(site)/ape-publice/api/*`). Every answer is parsed:
 * a shape the page does not know throws instead of drawing nonsense.
 */
export function createHttpPublicWatersSource(get: PublicWatersGet): PublicWatersSource {
  const parse = <T>(schema: z.ZodType<T>, v: unknown): T => schema.parse(v);
  return {
    async getWaterRowsInViewport(bounds, options = {}) {
      const res = await get('viewport', {
        ...boundsQuery(bounds),
        types: listQuery(options.types),
        counties: listQuery(options.counties),
        limit: options.limit,
      });
      return parse(z.array(publicWaterViewportRowSchema), res);
    },
    async getGeometriesByIds(ids) {
      if (!ids.length) return [];
      const res = await get('geometries', { ids: ids.join(',') });
      return parse(z.array(z.object({ id: z.number(), geometry: publicWaterGeometrySchema })), res);
    },
    async getMarkerWatersInViewport(bounds, options = {}) {
      const res = await get('markers', {
        ...boundsQuery(bounds),
        types: listQuery(options.types),
        counties: listQuery(options.counties),
        limit: options.limit,
      });
      return parse(z.array(publicWaterMarkerSchema), res);
    },
    async getPublicWaterById(id) {
      return parse(publicWaterDetailSchema.nullable(), await get(`water/${id}`));
    },
    async getPublicWaterByLinkCode(code) {
      return parse(publicWaterDetailSchema.nullable(), await get(`water/${encodeURIComponent(code)}`));
    },
    async searchPublicWaters(term, limit = 40) {
      if (term.trim().length < 2) return [];
      return parse(z.array(publicWaterListItemSchema), await get('search', { q: term.trim(), limit }));
    },
    async nearestWatersTo(lat, lng, limit = 5) {
      return parse(z.array(publicWaterListItemSchema), await get('nearest', { lat, lng, limit }));
    },
    async getCountyNamesByIds(ids) {
      if (!ids.length) return [];
      return parse(z.array(z.string()), await get('county-names', { ids: ids.join(',') }));
    },
    async getCounties() {
      return parse(z.array(publicWaterCountySchema), await get('counties'));
    },
    async getAttribution() {
      return parse(z.object({ attribution: z.string().nullable() }), await get('attribution')).attribution;
    },
    async getAllCentroids() {
      return decodeCentroids(parse(publicWaterCentroidsSchema, await get('centroids')));
    },
  };
}

// ── query factories (browser cache) ─────────────────────────────────────────────────────────

/** The bundled data never changes while a build is live: read once, keep for the session. */
const STATIC = { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000, retry: false } as const;

export const publicWaterSourceKeys = {
  all: ['public-waters', 'source'] as const,
  water: (id: number) => ['public-waters', 'source', 'water', id] as const,
  counties: ['public-waters', 'source', 'counties'] as const,
  centroids: ['public-waters', 'source', 'centroids'] as const,
  search: (term: string) => ['public-waters', 'source', 'search', term] as const,
  attribution: ['public-waters', 'source', 'attribution'] as const,
};

export function publicWaterByIdQuery(src: PublicWatersSource, id: number) {
  return queryOptions({ queryKey: publicWaterSourceKeys.water(id), queryFn: () => src.getPublicWaterById(id), ...STATIC });
}

export function publicWaterCountiesQuery(src: PublicWatersSource) {
  return queryOptions({ queryKey: publicWaterSourceKeys.counties, queryFn: () => src.getCounties(), ...STATIC });
}

export function publicWaterCentroidsQuery(src: PublicWatersSource) {
  return queryOptions({ queryKey: publicWaterSourceKeys.centroids, queryFn: () => src.getAllCentroids(), ...STATIC });
}

/** fish PublicWatersSearch: max 40, ≥2 characters (the caller debounces 250ms). */
export function publicWaterSearchQuery(src: PublicWatersSource, term: string) {
  const q = term.trim();
  return queryOptions({
    queryKey: publicWaterSourceKeys.search(q.toLowerCase()),
    queryFn: () => src.searchPublicWaters(q, 40),
    enabled: q.length >= 2,
    ...STATIC,
  });
}
