import { describe, expect, it } from 'vitest';
import type { PublicWaterDetail } from './publicWaters';
import {
  buildClusterIndex,
  clustersForViewport,
  clusterTapZoom,
  continuousZoom,
  EXPAND_SMALL,
  findWaterAtPoint,
  flattenWaterCoordinates,
  GEOMETRY_ENTER_ZOOM,
  nearestWithin,
  projectGeometry,
  reduceSelection,
  regionForWater,
  regionToBounds,
  resolveBand,
  waterFitBounds,
  type PublicSelection,
} from './publicWaterMap';

describe('band (fish band.ts)', () => {
  it('zoom = log2(360 / longitudeDelta)', () => {
    expect(continuousZoom(360)).toBe(0);
    expect(continuousZoom(360 / 2 ** 11)).toBeCloseTo(11);
  });

  it('hysteresis: enters at ≥ 11.2, leaves only at ≤ 10.6', () => {
    expect(resolveBand('clusters', 11.1)).toBe('clusters');
    expect(resolveBand('clusters', 11.2)).toBe('geometry');
    expect(resolveBand('geometry', 10.9)).toBe('geometry');
    expect(resolveBand('geometry', 10.6)).toBe('clusters');
  });

  it('cluster tap zooms to max(expansion, current + 1.2), capped at gate + 0.3', () => {
    expect(clusterTapZoom(9, 6)).toBe(9);
    expect(clusterTapZoom(6.1, 6)).toBeCloseTo(7.2);
    expect(clusterTapZoom(14, 10)).toBeCloseTo(GEOMETRY_ENTER_ZOOM + 0.3);
    expect(clusterTapZoom(undefined, 5)).toBe(7);
  });
});

describe('cluster index (fish clusterIndex.ts)', () => {
  const near = (id: number, lat: number, lng: number, type: 'river' | 'natural_lake' = 'natural_lake', countyId: number | null = 1) => ({
    id,
    type,
    countyId,
    lat,
    lng,
  });
  const centroids = [near(1, 45, 25), near(2, 45.001, 25.001), near(3, 45.002, 25.002, 'river'), near(4, 47, 27, 'natural_lake', 2)];
  const all = { minLat: 40, minLng: 20, maxLat: 50, maxLng: 30 };

  it('clusters close waters into a counted badge with an expansion zoom', () => {
    const index = buildClusterIndex(centroids, { maxZoom: 11 });
    const out = clustersForViewport(index, all, 5);
    const badge = out.find((c) => c.singleId == null);
    expect(badge?.count).toBe(3);
    expect(badge?.expansionZoom).toBeGreaterThan(5);
    expect(out.find((c) => c.singleId === 4)).toMatchObject({ key: 'p4', count: 1 });
  });

  it('expands clusters of ≤ 4 into pins from zoom 8.5', () => {
    const index = buildClusterIndex(centroids, { maxZoom: 11 });
    const out = clustersForViewport(index, all, 8.5, { expandSmall: EXPAND_SMALL });
    expect(out.every((c) => c.singleId != null)).toBe(true);
    expect(out.map((c) => c.singleId).sort()).toEqual([1, 2, 3, 4]);
  });

  it('filters by type and primary county', () => {
    const rivers = buildClusterIndex(centroids, { maxZoom: 11 }, ['river']);
    expect(clustersForViewport(rivers, all, 5).map((c) => c.singleId)).toEqual([3]);
    const county2 = buildClusterIndex(centroids, { maxZoom: 11 }, undefined, [2]);
    expect(clustersForViewport(county2, all, 5).map((c) => c.singleId)).toEqual([4]);
  });
});

describe('geometry + hit test (fish hitTest.ts)', () => {
  const square = projectGeometry({
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  });
  const river = projectGeometry({
    type: 'LineString',
    coordinates: [
      [2, 0],
      [2, 1],
    ],
  });

  it('projects bbox and vertices', () => {
    expect(square.bbox).toEqual({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 });
    expect(square.vertices).toBe(5);
  });

  it('polygon containment wins outright', () => {
    expect(findWaterAtPoint([{ id: 1, geometry: square }, { id: 2, geometry: river }], 0.5, 0.5, 0.01)).toBe(1);
  });

  it('rivers are hit within the tolerance, missed outside it', () => {
    expect(findWaterAtPoint([{ id: 2, geometry: river }], 0.5, 2.005, 0.01)).toBe(2);
    expect(findWaterAtPoint([{ id: 2, geometry: river }], 0.5, 2.5, 0.01)).toBeNull();
  });

  it('nearest marker within the px-box tolerance', () => {
    const items = [
      { id: 'a', centerLat: 0, centerLng: 0 },
      { id: 'b', centerLat: 0.05, centerLng: 0.05 },
    ];
    expect(nearestWithin(items, 0.04, 0.04, 0.02, 0.02)?.id).toBe('b');
    expect(nearestWithin(items, 0.5, 0.5, 0.02, 0.02)).toBeNull();
  });

  it('fit bounds: the bbox, or centre ± 0.1° under 2 coordinates', () => {
    const water = { centerLat: 45, centerLng: 25 };
    expect(waterFitBounds({ ...water, geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } })).toEqual([1, 2, 3, 4]);
    expect(waterFitBounds({ ...water, geometry: { type: 'LineString', coordinates: [[1, 2]] } })).toEqual([24.9, 44.9, 25.1, 45.1]);
    expect(flattenWaterCoordinates({ type: 'MultiLineString', coordinates: [[[1, 2]], [[3, 4]]] })).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe('regionForWater', () => {
  const viewport = { widthPx: 400, heightPx: 800, topObscuredPx: 100, bottomObscuredPx: 200 };
  it('falls back to a 0.02° box around the centre without geometry', () => {
    const r = regionForWater(null, { latitude: 45, longitude: 25 }, viewport);
    expect(r).toMatchObject({ latitude: 45, longitude: 25, latitudeDelta: 0.02 });
  });
  it('frames the water at ~60% of the usable band, never below the minimum span', () => {
    const r = regionForWater(
      { type: 'LineString', coordinates: [[25, 45], [25.0001, 45.0001]] },
      { latitude: 45, longitude: 25 },
      viewport,
    );
    expect(r.latitudeDelta).toBeGreaterThanOrEqual(0.008);
    const [w, s, e, n] = regionToBounds(r);
    expect(e - w).toBeCloseTo(r.longitudeDelta);
    expect(n - s).toBeCloseTo(r.latitudeDelta);
  });
});

describe('selection machine (fish publicWaterSelectionMachine.ts)', () => {
  const water = { id: 7 } as PublicWaterDetail;
  const none: PublicSelection<string> = { status: 'none' };

  it('select → load → preview frames the water; same id again is a no-op', () => {
    const a = reduceSelection(none, { type: 'SELECT_WATER', id: 7, origin: 'map', currentRegion: 'R0' });
    expect(a.selection).toMatchObject({ status: 'loading', id: 7, returnRegion: 'R0' });
    const b = reduceSelection(a.selection, { type: 'WATER_LOADED', id: 7, water });
    expect(b.camera).toEqual({ kind: 'frame', water });
    expect(reduceSelection(b.selection, { type: 'SELECT_WATER', id: 7, origin: 'list', currentRegion: 'R9' }).selection).toBe(b.selection);
  });

  it('a failed load returns silently to none; a stale load is ignored', () => {
    const a = reduceSelection(none, { type: 'SELECT_WATER', id: 7, origin: 'map', currentRegion: 'R0' });
    expect(reduceSelection(a.selection, { type: 'WATER_LOADED', id: 8, water }).selection).toBe(a.selection);
    expect(reduceSelection(a.selection, { type: 'WATER_LOAD_FAILED', id: 7 }).selection).toEqual({ status: 'none' });
  });

  it('chained selections keep the first region; closing restores it unless the user panned', () => {
    const a = reduceSelection(none, { type: 'SELECT_WATER', id: 7, origin: 'map', currentRegion: 'R0' });
    const b = reduceSelection(a.selection, { type: 'SELECT_WATER', id: 8, origin: 'pin', currentRegion: 'R1' });
    expect(b.selection).toMatchObject({ id: 8, returnRegion: 'R0' });
    expect(reduceSelection(b.selection, { type: 'CLOSE_PREVIEW' }).camera).toEqual({ kind: 'restore', region: 'R0' });
    const panned = reduceSelection(b.selection, { type: 'USER_PANNED' });
    expect(reduceSelection(panned.selection, { type: 'CLOSE_PREVIEW' }).camera).toBeNull();
  });
});
