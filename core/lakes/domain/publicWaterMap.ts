import Supercluster from 'supercluster';
import type { PublicWaterDetail, PublicWaterGeometry, PublicWaterType } from './publicWaters';
import type { LatLngBounds, PublicWaterCentroid } from '../publicWatersSource';

/*
 * Pure logic of the Ape-publice map — ports of fish features/public-waters/{band, clusterIndex,
 * hitTest, regionForWater, publicWaterSelectionMachine}.ts. No I/O, no map library.
 *
 * ZOOM SCALE (fish band.ts / clusterIndex.ts): the map's zoom is fish's screen convention,
 * log2(360 / longitudeDelta) of what the map shows — «screen width = one tile», not the map
 * library's own zoom. The band gate, the cluster index and its expansion zooms are all in that
 * scale; the web page computes it from the map's visible bounds (`screenZoom`).
 */

// ── band.ts ─────────────────────────────────────────────────────────────────────────────────

export type PublicMapBand = 'clusters' | 'geometry';

/** Enter the geometry band zooming IN past this… */
export const GEOMETRY_ENTER_ZOOM = 11.2;
/** …and leave it only when zooming OUT past this (hysteresis kills boundary flapping). */
export const GEOMETRY_EXIT_ZOOM = 10.6;
/** supercluster maxZoom — clusters keep splitting up to the enter threshold. */
export const CLUSTER_MAX_ZOOM = 11;
/** From this zoom on, clusters of ≤ SMALL_CLUSTER_MAX_COUNT expand into individual pins. */
export const SMALL_CLUSTER_EXPAND_ZOOM = 8.5;
export const SMALL_CLUSTER_MAX_COUNT = 4;
/** In the geometry band, waters whose projected bbox is smaller than this render as pins. */
export const MIN_SHAPE_PX = 24;
/** fish MapView.onPress: the nearest marker within this many px wins the tap. */
export const MARKER_TAP_RADIUS_PX = 36;
/** fish: shapes are hit-tested with a constant ~14px forgiveness. */
export const SHAPE_TAP_TOLERANCE_PX = 14;
/** fish usePublicWatersInViewport / usePublicWaterMarkers caps. */
export const VIEWPORT_LIMIT = 1500;
export const MARKER_LIMIT = 150;

/** Continuous zoom in the app's screen convention: log2(360 / longitudeDelta). */
export function continuousZoom(longitudeDelta: number): number {
  return Math.log2(360 / Math.max(longitudeDelta, 0.0001));
}

/** Next band given the previous one — plain hysteresis. */
export function resolveBand(prev: PublicMapBand, zoom: number): PublicMapBand {
  if (prev === 'clusters') return zoom >= GEOMETRY_ENTER_ZOOM ? 'geometry' : 'clusters';
  return zoom <= GEOMETRY_EXIT_ZOOM ? 'clusters' : 'geometry';
}

/**
 * fish handlePublicClusterPress: a multi-water cluster tap always zooms in visibly —
 * max(expansionZoom, current + 1.2) — capped just inside the geometry band (gate + 0.3).
 */
export function clusterTapZoom(expansionZoom: number | undefined, currentZoom: number): number {
  return Math.min(Math.max(expansionZoom ?? currentZoom + 2, currentZoom + 1.2), GEOMETRY_ENTER_ZOOM + 0.3);
}

// ── clusterIndex.ts ─────────────────────────────────────────────────────────────────────────

/** A cluster badge, or a single water drawn as an icon pin (`singleId`). fish PublicWaterCluster. */
export interface PublicWaterCluster {
  key: string;
  count: number;
  centerLat: number;
  centerLng: number;
  expansionZoom?: number;
  singleId: number | null;
}

type CentroidProps = { id: number; type: PublicWaterType; countyId: number | null };
type ClusterProps = { cluster: true; cluster_id: number; point_count: number };
type PointFeature<P> = { type: 'Feature'; geometry: { type: 'Point'; coordinates: number[] }; properties: P };
export type WaterClusterIndex = Supercluster<CentroidProps, Record<string, unknown>>;

/** Build an index over the centroids of the active filters (type + primary county). */
export function buildClusterIndex(
  centroids: ReadonlyArray<PublicWaterCentroid>,
  options: { radius?: number; maxZoom: number },
  types?: PublicWaterType[],
  counties?: number[],
): WaterClusterIndex {
  const typeSet = types && types.length > 0 ? new Set(types) : null;
  const countySet = counties && counties.length > 0 ? new Set(counties) : null;
  const points = centroids
    .filter((c) => (!typeSet || typeSet.has(c.type)) && (!countySet || (c.countyId != null && countySet.has(c.countyId))))
    .map(
      (c): PointFeature<CentroidProps> => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { id: c.id, type: c.type, countyId: c.countyId },
      }),
    );
  return new Supercluster<CentroidProps, Record<string, unknown>>({
    radius: options.radius ?? 70,
    maxZoom: options.maxZoom,
    minPoints: 2,
  }).load(points);
}

/**
 * Clusters for a viewport. Multi-point clusters carry their `expansionZoom`; single points carry
 * `singleId`. From `expandSmall.minZoom`, clusters of ≤ `maxCount` are expanded into their pins.
 */
export function clustersForViewport(
  index: WaterClusterIndex,
  bounds: LatLngBounds,
  zoom: number,
  options?: { expandSmall?: { minZoom: number; maxCount: number } },
): PublicWaterCluster[] {
  const raw = index.getClusters([bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat], Math.floor(zoom));
  const expandSmall = options?.expandSmall && zoom >= options.expandSmall.minZoom ? options.expandSmall : null;
  return raw.flatMap((f): PublicWaterCluster[] => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties as unknown as ClusterProps | CentroidProps;
    if ('cluster' in props && props.cluster) {
      const clusterId = props.cluster_id;
      if (expandSmall && props.point_count <= expandSmall.maxCount) {
        try {
          return index.getLeaves(clusterId, expandSmall.maxCount).map((leaf) => {
            const [leafLng, leafLat] = leaf.geometry.coordinates;
            const water = leaf.properties as CentroidProps;
            return { key: `p${water.id}`, count: 1, centerLat: leafLat, centerLng: leafLng, singleId: water.id };
          });
        } catch {
          // fall through to the badge
        }
      }
      let expansionZoom: number | undefined;
      try {
        expansionZoom = index.getClusterExpansionZoom(clusterId);
      } catch {
        expansionZoom = undefined;
      }
      return [{ key: `c${clusterId}`, count: props.point_count, centerLat: lat, centerLng: lng, expansionZoom, singleId: null }];
    }
    const water = props as CentroidProps;
    return [{ key: `p${water.id}`, count: 1, centerLat: lat, centerLng: lng, singleId: water.id }];
  });
}

export const EXPAND_SMALL = { minZoom: SMALL_CLUSTER_EXPAND_ZOOM, maxCount: SMALL_CLUSTER_MAX_COUNT } as const;

// ── geometry projection + hitTest.ts ────────────────────────────────────────────────────────

export interface GeoBBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type LngLat = [lng: number, lat: number];

/** A geometry as lines (rivers) and polygons ([outer, ...holes]) plus its bbox. */
export interface ProjectedGeometry {
  lines: LngLat[][];
  polys: LngLat[][][];
  bbox: GeoBBox;
  vertices: number;
}

export function projectGeometry(geom: PublicWaterGeometry): ProjectedGeometry {
  const lines: LngLat[][] = [];
  const polys: LngLat[][][] = [];
  const bbox: GeoBBox = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
  let vertices = 0;
  const conv = (pairs: [number, number][]): LngLat[] =>
    pairs.map(([lng, lat]) => {
      if (lat < bbox.minLat) bbox.minLat = lat;
      if (lat > bbox.maxLat) bbox.maxLat = lat;
      if (lng < bbox.minLng) bbox.minLng = lng;
      if (lng > bbox.maxLng) bbox.maxLng = lng;
      vertices++;
      return [lng, lat];
    });
  if (geom.type === 'LineString') lines.push(conv(geom.coordinates));
  else if (geom.type === 'MultiLineString') geom.coordinates.forEach((seg) => lines.push(conv(seg)));
  else if (geom.type === 'Polygon') polys.push(geom.coordinates.map(conv));
  else geom.coordinates.forEach((poly) => polys.push(poly.map(conv)));
  return { lines, polys, vertices, bbox };
}

/** Every coordinate of a geometry, flattened (fish flattenWaterCoordinates). */
export function flattenWaterCoordinates(geom: PublicWaterGeometry): LngLat[] {
  const p = projectGeometry(geom);
  return [...p.lines.flat(), ...p.polys.flat(2)];
}

/**
 * The [west, south, east, north] box a static map fits (fish hero / harta): the geometry's bbox,
 * or the centre ± 0.1° when the geometry has fewer than 2 coordinates.
 */
export function waterFitBounds(water: { geometry: PublicWaterGeometry; centerLat: number; centerLng: number }): [number, number, number, number] {
  const p = projectGeometry(water.geometry);
  if (p.vertices < 2 || !Number.isFinite(p.bbox.minLat)) {
    return [water.centerLng - 0.1, water.centerLat - 0.1, water.centerLng + 0.1, water.centerLat + 0.1];
  }
  return [p.bbox.minLng, p.bbox.minLat, p.bbox.maxLng, p.bbox.maxLat];
}

export interface HitCandidate {
  id: number;
  geometry: ProjectedGeometry;
}

function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: LngLat[][]): boolean {
  if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (pointInRing(lng, lat, rings[k])) return false;
  return true;
}

function distToSegment(px: number, py: number, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function distToLines(lng: number, lat: number, lines: LngLat[][]): number {
  let dmin = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const d = distToSegment(lng, lat, line[i - 1], line[i]);
      if (d < dmin) dmin = d;
    }
  }
  return dmin;
}

/**
 * The water under a tapped point: polygon containment wins outright; otherwise rivers AND polygon
 * edges compete by distance within `toleranceDeg`. Returns the id or null.
 */
export function findWaterAtPoint(candidates: ReadonlyArray<HitCandidate>, lat: number, lng: number, toleranceDeg: number): number | null {
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const { bbox, polys, lines } = cand.geometry;
    if (
      lat < bbox.minLat - toleranceDeg ||
      lat > bbox.maxLat + toleranceDeg ||
      lng < bbox.minLng - toleranceDeg ||
      lng > bbox.maxLng + toleranceDeg
    ) {
      continue;
    }
    if (polys.length) {
      if (polys.some((rings) => pointInPolygon(lng, lat, rings))) return cand.id;
      for (const rings of polys) {
        const d = distToLines(lng, lat, rings);
        if (d <= toleranceDeg && d < bestDist) {
          bestDist = d;
          bestId = cand.id;
        }
      }
    }
    if (lines.length) {
      const d = distToLines(lng, lat, lines);
      if (d <= toleranceDeg && d < bestDist) {
        bestDist = d;
        bestId = cand.id;
      }
    }
  }
  return bestId;
}

/** The nearest point within an px-box tolerance (fish nearest cluster / pin to a tap). */
export function nearestWithin<T extends { centerLat: number; centerLng: number }>(
  items: ReadonlyArray<T>,
  lat: number,
  lng: number,
  latTol: number,
  lngTol: number,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const dLat = Math.abs(it.centerLat - lat);
    const dLng = Math.abs(it.centerLng - lng);
    if (dLat <= latTol && dLng <= lngTol) {
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
  }
  return best;
}

// ── regionForWater.ts ───────────────────────────────────────────────────────────────────────

/** fish Region: a centre and the lat / lng spans. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const FILL = 0.6;
export const MIN_LAT_DELTA = 0.008;
export const FALLBACK_DELTA = 0.02;

export interface FrameViewport {
  widthPx: number;
  heightPx: number;
  topObscuredPx: number;
  bottomObscuredPx: number;
}

/**
 * Camera region that frames a public water inside the usable band of the map (not under the
 * floating chrome or the preview card): ~60% of the band on its constraining axis, the water's
 * centre mid-band. fish regionForWater, unchanged.
 */
export function regionForWater(
  geometry: PublicWaterGeometry | null | undefined,
  center: { latitude: number; longitude: number },
  viewport: FrameViewport,
): MapRegion {
  const { widthPx, heightPx, topObscuredPx, bottomObscuredPx } = viewport;
  const usableH = Math.max(heightPx - topObscuredPx - bottomObscuredPx, heightPx * 0.2);
  const usableHFrac = usableH / heightPx;
  const box = geometry ? projectGeometry(geometry) : null;
  if (!box || box.vertices < 2) {
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: FALLBACK_DELTA,
      longitudeDelta: FALLBACK_DELTA * (heightPx > 0 ? widthPx / heightPx : 0.5),
    };
  }
  const { minLat, maxLat, minLng, maxLng } = box.bbox;
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  const waterLat = (minLat + maxLat) / 2;
  const waterLng = (minLng + maxLng) / 2;
  const aspect = (heightPx / widthPx) * Math.cos((waterLat * Math.PI) / 180);
  const latNeed = spanLat / (FILL * usableHFrac);
  const latFromLng = (spanLng / FILL) * aspect;
  const latitudeDelta = Math.max(latNeed, latFromLng, MIN_LAT_DELTA);
  const longitudeDelta = latitudeDelta / aspect;
  const bandCenterFrac = (topObscuredPx + usableH / 2) / heightPx;
  const latitude = waterLat + (bandCenterFrac - 0.5) * latitudeDelta;
  return { latitude, longitude: waterLng, latitudeDelta, longitudeDelta };
}

/** A region as [west, south, east, north] bounds (what the web map fits). */
export function regionToBounds(r: MapRegion): [number, number, number, number] {
  return [r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2];
}

// ── publicWaterSelectionMachine.ts ──────────────────────────────────────────────────────────

export type SelectOrigin = 'map' | 'pin' | 'list' | 'search';

/** `returnRegion` is whatever the page needs to restore the camera (bounds on the web). */
export type PublicSelection<R = unknown> =
  | { status: 'none' }
  | { status: 'loading'; id: number; origin: SelectOrigin; returnRegion: R | null }
  | { status: 'previewing'; id: number; origin: SelectOrigin; water: PublicWaterDetail; returnRegion: R | null };

export type CameraCommand<R = unknown> = { kind: 'frame'; water: PublicWaterDetail } | { kind: 'restore'; region: R };

export type SelectionEvent<R = unknown> =
  | { type: 'SELECT_WATER'; id: number; origin: SelectOrigin; currentRegion: R }
  | { type: 'WATER_LOADED'; id: number; water: PublicWaterDetail }
  | { type: 'WATER_LOAD_FAILED'; id: number }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'USER_PANNED' }
  | { type: 'EXIT' };

export interface SelectionTransition<R = unknown> {
  selection: PublicSelection<R>;
  camera: CameraCommand<R> | null;
}

/**
 * fish reduceSelection: every selection origin funnels through SELECT_WATER; re-selecting the
 * water already shown is a no-op; a failed load returns silently to none; closing restores the
 * region captured at the FIRST selection, unless the user panned during the preview.
 */
export function reduceSelection<R>(state: PublicSelection<R>, ev: SelectionEvent<R>): SelectionTransition<R> {
  switch (ev.type) {
    case 'SELECT_WATER': {
      if (state.status !== 'none' && state.id === ev.id) return { selection: state, camera: null };
      const returnRegion = state.status === 'none' ? ev.currentRegion : state.returnRegion;
      return { selection: { status: 'loading', id: ev.id, origin: ev.origin, returnRegion }, camera: null };
    }
    case 'WATER_LOADED': {
      if (state.status !== 'loading' || state.id !== ev.id) return { selection: state, camera: null };
      return {
        selection: { status: 'previewing', id: ev.id, origin: state.origin, water: ev.water, returnRegion: state.returnRegion },
        camera: { kind: 'frame', water: ev.water },
      };
    }
    case 'WATER_LOAD_FAILED': {
      if (state.status !== 'loading' || state.id !== ev.id) return { selection: state, camera: null };
      return { selection: { status: 'none' }, camera: null };
    }
    case 'CLOSE_PREVIEW': {
      if (state.status === 'none') return { selection: state, camera: null };
      return { selection: { status: 'none' }, camera: state.returnRegion ? { kind: 'restore', region: state.returnRegion } : null };
    }
    case 'USER_PANNED': {
      if (state.status === 'none' || state.returnRegion === null) return { selection: state, camera: null };
      return { selection: { ...state, returnRegion: null }, camera: null };
    }
    case 'EXIT':
      return { selection: { status: 'none' }, camera: null };
  }
}
