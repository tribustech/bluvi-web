import { NextResponse, type NextRequest } from 'next/server';
import { encodeCentroids, publicWaterTypeSchema, type LatLngBounds, type PublicWaterType } from '@/core/lakes';
import { cmsUrl } from '@/lib/server/env';
import { sqlitePublicWatersSource as src } from '../../_server/source';
import { originOf, PHOTO_MAX_BYTES, photoProxyTarget } from '../../_server/photoProxy';

/*
 * The public-waters dataset for the browser (the map, the search, the county filter) — the web's
 * stand-in for fish's on-device SQLite queries. Read by core `createHttpPublicWatersSource`, which
 * validates every answer. GET only, public, no session: the data is the same for everyone and only
 * changes with a new build, so answers are cacheable by the browser and the CDN.
 *
 *   viewport?minLat&minLng&maxLat&maxLng[&types][&counties][&limit]   fish getWaterRowsInViewport
 *   markers?…same…                                                    fish getMarkerWatersInViewport
 *   geometries?ids=1,2                                                fish getGeometriesByIds
 *   water/<id | linkCode>                                             fish getPublicWaterById / ByLinkCode
 *   search?q[&limit]                                                  fish searchPublicWaters
 *   nearest?lat&lng[&limit]                                           fish nearestWatersTo
 *   county-names?ids=1,2 · counties · attribution · centroids
 *   foto?src=<CMS photo URL>                                          the share card's photo, same-origin (_server/photoProxy.ts)
 */

const CACHE = { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: status === 200 ? CACHE : undefined });
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

function num(sp: URLSearchParams, key: string): number | null {
  const raw = sp.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function bounds(sp: URLSearchParams): LatLngBounds | null {
  const minLat = num(sp, 'minLat');
  const minLng = num(sp, 'minLng');
  const maxLat = num(sp, 'maxLat');
  const maxLng = num(sp, 'maxLng');
  if (minLat == null || minLng == null || maxLat == null || maxLng == null) return null;
  return { minLat, minLng, maxLat, maxLng };
}

function ids(sp: URLSearchParams, key: string, max: number): number[] {
  return (sp.get(key) ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .slice(0, max);
}

function types(sp: URLSearchParams): PublicWaterType[] | undefined {
  const out = (sp.get('types') ?? '').split(',').flatMap((t) => {
    const p = publicWaterTypeSchema.safeParse(t);
    return p.success ? [p.data] : [];
  });
  return out.length ? out : undefined;
}

const clamp = (n: number | null, fallback: number, max: number) => Math.max(1, Math.min(max, n ?? fallback));

export async function GET(request: NextRequest, ctx: RouteContext<'/ape-publice/api/[...slug]'>) {
  const { slug } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const [what, ...rest] = slug;
  try {
    switch (what) {
      case 'viewport':
      case 'markers': {
        const b = bounds(sp);
        if (!b) return bad('bounds');
        const counties = ids(sp, 'counties', 60);
        const options = { types: types(sp), counties: counties.length ? counties : undefined };
        return what === 'viewport'
          ? json(await src.getWaterRowsInViewport(b, { ...options, limit: clamp(num(sp, 'limit'), 1500, 1500) }))
          : json(await src.getMarkerWatersInViewport(b, { ...options, limit: clamp(num(sp, 'limit'), 150, 150) }));
      }
      case 'geometries':
        return json(await src.getGeometriesByIds(ids(sp, 'ids', 1500)));
      case 'water': {
        const param = decodeURIComponent(rest.join('/')).trim();
        if (!param) return json(null);
        const id = /^[1-9]\d*$/.test(param) && Number.isSafeInteger(Number(param)) ? Number(param) : null;
        return json(id != null ? await src.getPublicWaterById(id) : await src.getPublicWaterByLinkCode(param));
      }
      case 'search':
        return json(await src.searchPublicWaters(sp.get('q') ?? '', clamp(num(sp, 'limit'), 40, 40)));
      case 'nearest': {
        const lat = num(sp, 'lat');
        const lng = num(sp, 'lng');
        if (lat == null || lng == null) return bad('lat/lng');
        // Per-position: the CDN must not share it.
        return NextResponse.json(await src.nearestWatersTo(lat, lng, clamp(num(sp, 'limit'), 5, 20)), {
          headers: { 'cache-control': 'private, max-age=300' },
        });
      }
      case 'county-names':
        return json(await src.getCountyNamesByIds(ids(sp, 'ids', 60)));
      case 'counties':
        return json(await src.getCounties());
      case 'attribution':
        return json({ attribution: await src.getAttribution() });
      case 'centroids':
        return json(encodeCentroids(await src.getAllCentroids()));
      case 'foto':
        return await photo(sp.get('src'));
      default:
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
  } catch (e) {
    console.error('[ape-publice/api]', what, e);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}

/** A CMS catch photo passed through same-origin, so the share card's canvas can export it. */
async function photo(raw: string | null): Promise<Response> {
  let cms: string | null = null;
  try {
    cms = originOf(cmsUrl());
  } catch {
    cms = null;
  }
  const target = photoProxyTarget(raw, cms);
  if (!target) return bad('src');
  const res = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const type = res.headers.get('content-type') ?? '';
  const length = Number(res.headers.get('content-length') ?? '0');
  if (!res.ok || !type.startsWith('image/') || length > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
  const body = await res.arrayBuffer();
  if (body.byteLength > PHOTO_MAX_BYTES) return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  return new Response(body, {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=86400, s-maxage=604800', 'x-content-type-options': 'nosniff' },
  });
}
