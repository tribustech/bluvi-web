// Ported from fish `features/partide/helpers/castGeometry.ts` + `helpers/geo.ts` (pure).
/**
 * Shared cast-distance geometry for the rod-config screen (schematic diagram + real-map rings) and
 * the catch-placement maths of the capture flow. fish keeps the coordinate helpers in a separate
 * `geo.ts`; the web has one module for both (the capture flow and rod config share them).
 */
export const DIST_MIN = 10;
export const DIST_STEP = 5;
export const DIST_HARD_MAX = 600; // safety ceiling — bait-boat "plantat" reaches far past a cast

// The view's far edge scales through these tiers so big "plantat" distances
// stay on-screen instead of being clipped at a fixed cap.
export const VIEW_TIERS = [150, 200, 250, 300, 400, 500, 600];
export const viewMaxFor = (d: number): number => VIEW_TIERS.find(t => t >= d) ?? DIST_HARD_MAX;

export type LatLng = { lat: number; lng: number };

/**
 * Session anchor (stand / start pin) as a coord, or null when unusable.
 * 0/0 = legacy row without coordinates (hydrate defaults) — never a real venue.
 */
export function anchorCoord(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const R = 6_371_000; // earth radius (m)
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance from anchor to a coord, rounded to the nearest `step` meters. */
export function distanceFromAnchor(anchor: LatLng, coord: LatLng, step = 5): number {
  return Math.round(haversineMeters(anchor, coord) / step) * step;
}

/** Initial compass bearing a→b in degrees, normalized to [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
