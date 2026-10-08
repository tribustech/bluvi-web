// Ported from fish `features/partide/helpers/nearbyWater.ts` (pure).
// Pure logic for the map picker's "what water is the pin on?" feedback. Two tiers: catalog bălți
// are scanned against the cached /feed/lakes/index; public waters are hit-tested against the ANAR
// dataset (on the web: the site's own route, app/(site)/partide/incepe/api/apa-la-punct).
import type { LakeIndexEntry } from '../../lakes/schemas';
import type { PublicWaterType } from '../../lakes/domain/publicWaters';
import { PUBLIC_WATER_TYPE_LABEL } from '../../lakes/domain/publicWaterDetail';
import { haversineMeters, type LatLng } from './castGeometry';

/** Same radius resolvePinVenue tier (a) uses to attribute a pin to a bălță. */
export const NEARBY_LAKE_RADIUS_M = 400;
/** Above this latitude span (~county level) detection is off entirely. */
export const MAX_DETECTION_SPAN_DEG = 0.35;
/** Confirm-time hit tolerance (pinVenue) — the floor for the zoom-scaled value. */
export const MIN_HIT_TOLERANCE_DEG = 0.002;

/** Nearest indexed bălță within `radiusM` of the pin, or null. ≤500 rows → O(n) is fine per frame. */
export function nearestLakeWithin(
  coord: LatLng,
  lakes: LakeIndexEntry[] | undefined,
  radiusM: number = NEARBY_LAKE_RADIUS_M,
): LakeIndexEntry | null {
  if (!lakes?.length) return null;
  let best: { lake: LakeIndexEntry; dist: number } | null = null;
  for (const candidate of lakes) {
    const dist = haversineMeters(coord, { lat: candidate.lat, lng: candidate.lng });
    if (dist <= radiusM && (!best || dist < best.dist)) best = { lake: candidate, dist };
  }
  return best?.lake ?? null;
}

export function detectionEnabled(spanDeg: number): boolean {
  return spanDeg <= MAX_DETECTION_SPAN_DEG;
}

/** "Near" scales with zoom so it matches what looks near on screen. */
export function hitToleranceForSpan(spanDeg: number): number {
  return Math.max(MIN_HIT_TOLERANCE_DEG, spanDeg * 0.02);
}

/** Pill copy. A bălță match wins (more specific venue — mirrors resolvePinVenue priority). */
export function waterPillText(
  lake: Pick<LakeIndexEntry, 'name' | 'locality'> | null,
  water: { name: string | null; type: PublicWaterType } | null,
): string | null {
  if (lake) return lake.locality ? `${lake.name} · ${lake.locality}` : lake.name;
  if (water) return `${water.name ?? 'Apă publică'} · ${PUBLIC_WATER_TYPE_LABEL[water.type]}`;
  return null;
}

/** Monotonic token guard so a slow async hit-test can't overwrite a newer result. */
export function createLatestGuard(): { next(): number; isCurrent(token: number): boolean } {
  let seq = 0;
  return {
    next: () => ++seq,
    isCurrent: (token: number) => token === seq,
  };
}
