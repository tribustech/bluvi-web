/*
 * T2 geometry — plain data shared by the map, the list filter and the pages that use the template.
 * Bounds are [west, south, east, north] (GeoJSON bbox order, the order MapLibre takes).
 */

export type T2Bounds = [west: number, south: number, east: number, north: number];

export type T2LatLng = { lat: number; lng: number };

/** A thing the map can show: an id (the list key too) and a position. */
export type T2MapPoint = T2LatLng & { id: string };

/**
 * What the map reports after it settles. `userGesture`: a pan/zoom by the user, not code.
 * When the map cannot show (no WebGL, style host down) it reports its start bounds once, with a
 * NaN zoom, so a page waiting for the first viewport still renders its list.
 */
export type T2Viewport = { bounds: T2Bounds; zoom: number; userGesture: boolean };

/**
 * Romania overview — fish `getMapFocusRegion.ts#COUNTRY_OVERVIEW_REGION` (centre 45.94, 24.97,
 * 6° × 10°) written as bounds. The map frames it at load and after «Șterge filtre».
 */
export const ROMANIA_BOUNDS: T2Bounds = [19.97, 42.94, 29.97, 48.94];

export function boundsContain([west, south, east, north]: T2Bounds, p: T2LatLng): boolean {
  return p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east;
}

/** Bounds of a set of points, or null when empty. */
export function boundsOf(points: ReadonlyArray<T2LatLng>): T2Bounds | null {
  if (!points.length) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return [west, south, east, north];
}

/** A square box of `km` around a point (fish locate: centre on the user at min(radius, 20) km). */
export function boundsAround(p: T2LatLng, km: number): T2Bounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(Math.cos((p.lat * Math.PI) / 180), 0.1));
  return [p.lng - dLng, p.lat - dLat, p.lng + dLng, p.lat + dLat];
}
