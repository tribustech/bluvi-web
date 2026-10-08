import { NextResponse, type NextRequest } from 'next/server';
import { findWaterAtPoint, projectGeometry, publicWaterListItemSchema, type PublicWaterListItem } from '@/core/lakes';
import { WATER_HIT_TOLERANCE_DEG } from '@/core/partide';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PUBLIC_WATERS_DB_VERSION, sqlitePublicWatersSource as src } from '../../../../ape-publice/_server/source';
import { nearestCountyTo } from './nearestCounty';

/*
 * GET /partide/incepe/api/apa-la-punct?lat&lng[&tol] — the public water under a dropped pin and the
 * pin's county, for «Începe o partidă» (parity partide.incepe c5, c7). The web's stand-in for two
 * of fish's on-device SQLite reads (features/public-waters/queries.ts):
 *  - getWaterAtPoint(lat, lng, tol): the waters whose bbox holds the point ± tol, smallest bbox
 *    first, 80 at most, hit-tested on their geometry (polygon containment wins, else the nearest
 *    line / edge within tol) — core/lakes findWaterAtPoint, the same test fish runs;
 *  - nearestCountyTo(lat, lng): the county of the nearest water centre with a county, over the whole
 *    table (the pin's «Jud. {county}») — ./nearestCounty, fish's SQL verbatim.
 * Read-only over the same bundled dataset as /ape-publice/api (app/(site)/ape-publice/_server/
 * source.ts). Public, no session; the answer is per position, so the CDN does not share it.
 *
 *   → { water: PublicWaterListItem | null, county: string | null }
 */

const MAX_TOLERANCE_DEG = 0.05;
/** fish: `ORDER BY bbox area ASC LIMIT 80` — the viewport query has no order, so read more and sort. */
const HIT_CANDIDATES = 80;
const VIEWPORT_LIMIT = 600;

function num(request: NextRequest, key: string): number | null {
  const raw = request.nextUrl.searchParams.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function waterAt(lat: number, lng: number, tol: number): Promise<PublicWaterListItem | null> {
  const rows = await src.getWaterRowsInViewport({ minLat: lat - tol, maxLat: lat + tol, minLng: lng - tol, maxLng: lng + tol }, { limit: VIEWPORT_LIMIT });
  const candidates = rows.sort((a, b) => a.bboxSpanLat * a.bboxSpanLng - b.bboxSpanLat * b.bboxSpanLng).slice(0, HIT_CANDIDATES);
  if (!candidates.length) return null;
  const geometries = await src.getGeometriesByIds(candidates.map(c => c.id));
  const hitId = findWaterAtPoint(
    geometries.map(g => ({ id: g.id, geometry: projectGeometry(g.geometry) })),
    lat,
    lng,
    tol,
  );
  const row = hitId == null ? undefined : candidates.find(c => c.id === hitId);
  if (!row) return null;
  // The list item's shape (the viewport row's bbox spans dropped).
  return publicWaterListItemSchema.parse(row);
}

// Its own read-only handle on the same file (source.ts keeps its handle private and is not edited
// from here), opened once per server process.
let countyDb: DatabaseSync | null = null;
function countyAt(lat: number, lng: number): string | null {
  countyDb ??= new DatabaseSync(
    process.env.PUBLIC_WATERS_DB ?? path.join(process.cwd(), 'data', 'public-waters', `public-waters.v${PUBLIC_WATERS_DB_VERSION}.sqlite3`),
    { readOnly: true },
  );
  return nearestCountyTo(countyDb, lat, lng);
}

export async function GET(request: NextRequest) {
  const lat = num(request, 'lat');
  const lng = num(request, 'lng');
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat/lng' }, { status: 400 });
  }
  const tol = Math.min(MAX_TOLERANCE_DEG, Math.max(0, num(request, 'tol') ?? WATER_HIT_TOLERANCE_DEG));
  try {
    const [water, county] = await Promise.all([waterAt(lat, lng, tol), Promise.resolve().then(() => countyAt(lat, lng))]);
    return NextResponse.json({ water, county }, { headers: { 'cache-control': 'private, max-age=300' } });
  } catch (e) {
    console.error('[partide/incepe/apa-la-punct]', e);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
