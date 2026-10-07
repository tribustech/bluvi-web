// Ported from fish `features/partide/helpers/derivedLane.ts` (pure).
/**
 * Derived lane for map-placed rods («Unde ai lansat?» Hartă mode).
 *
 * Stânga/Centru/Dreapta is relative to where the angler faces, which raw
 * coordinates can't tell us — so «forward» is defined as the circular mean
 * bearing of ALL the session's map-placed casts from the anchor: exactly how
 * an angler pictures the middle of their own swim. A rod's lane can therefore
 * shift when another cast is added — which is why this is DERIVED at read time,
 * never written back to the rod (no sync churn, no cross-rod mutation).
 *
 * When every map cast sits inside the Centru cone the reference is degenerate:
 * «forward» is just that rod's own bearing (a single pin always is), so the
 * classifier would answer Centru wherever the pin was dropped. It says nothing
 * instead — the caller shows the distance alone. Reported from the lake as
 * "oriunde dau, e pă centru" (prod feedback #110).
 *
 * Schematic rods keep their stored lane; a map rod with no usable anchor has
 * no honest lane (null → caller shows distance only).
 */
import { bearingDeg, type LatLng } from './castGeometry';
import type { Lane, LocalRod } from './types';

/** Casts within ±this many degrees of the swim's mean bearing read as Centru. */
export const LANE_TOLERANCE_DEG = 15;

const castOf = (r: Pick<LocalRod, 'castLat' | 'castLng'>): LatLng | null =>
  r.castLat != null && r.castLng != null ? { lat: r.castLat, lng: r.castLng } : null;

/** Signed smallest angular difference a−b, wrapped to [−180, 180). */
const angleDiff = (a: number, b: number): number => ((a - b + 540) % 360) - 180;

export function laneForRod(rods: Pick<LocalRod, 'castLat' | 'castLng'>[], rod: Pick<LocalRod, 'castLat' | 'castLng' | 'lane'>, anchor: LatLng | null): Lane | null {
  const cast = castOf(rod);
  if (!cast) return rod.lane; // schematic placement — the stored lane is the truth
  if (!anchor) return null; // map pin without an origin — no honest lane to show

  // «Forward» = circular mean of every map-placed cast's bearing from the anchor.
  const bearings = rods
    .map(castOf)
    .filter((c): c is LatLng => c != null)
    .map(c => bearingDeg(anchor, c));
  const sumSin = bearings.reduce((s, b) => s + Math.sin((b * Math.PI) / 180), 0);
  const sumCos = bearings.reduce((s, b) => s + Math.cos((b * Math.PI) / 180), 0);
  const mean = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;

  // Degenerate reference — no lane is honest here (see the note above).
  const spread = Math.max(...bearings.map(b => Math.abs(angleDiff(b, mean))));
  if (spread <= LANE_TOLERANCE_DEG) return null;

  const delta = angleDiff(bearingDeg(anchor, cast), mean);
  if (Math.abs(delta) <= LANE_TOLERANCE_DEG) return 'center';
  return delta < 0 ? 'left' : 'right';
}
