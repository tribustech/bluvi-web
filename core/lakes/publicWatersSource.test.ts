import { describe, expect, it } from 'vitest';
import {
  createHttpPublicWatersSource,
  decodeCentroids,
  encodeCentroids,
  publicWaterSearchQuery,
  publicWaterSourceKeys,
  type PublicWatersGet,
} from './publicWatersSource';

const listItem = {
  id: 2245,
  name: 'Snagov',
  type: 'reservoir_lake',
  county: 'Ilfov',
  countyId: 36,
  countyIds: [36],
  centerLat: 44.7,
  centerLng: 26.17,
  linkCode: 'R:RO11_01.018_R1',
  areaKm2: 5.57,
};

function fakeGet(answers: unknown[]) {
  const calls: { path: string; query?: Record<string, unknown> }[] = [];
  const get: PublicWatersGet = async (path, query) => {
    calls.push({ path, query });
    return answers.shift();
  };
  return { get, calls };
}

describe('createHttpPublicWatersSource', () => {
  it('viewport: bounds, types, counties and limit as plain query params; rows parsed', async () => {
    const { get, calls } = fakeGet([[{ ...listItem, bboxSpanLat: 0.1, bboxSpanLng: 0.2 }]]);
    const src = createHttpPublicWatersSource(get);
    const rows = await src.getWaterRowsInViewport({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 }, { types: ['river'], counties: [36, 9], limit: 1500 });
    expect(rows[0].bboxSpanLng).toBe(0.2);
    expect(calls[0]).toEqual({ path: 'viewport', query: { minLat: 1, minLng: 2, maxLat: 3, maxLng: 4, types: 'river', counties: '36,9', limit: 1500 } });
  });

  it('detail by link code URL-encodes the code; null is «not found»', async () => {
    const { get, calls } = fakeGet([null]);
    const src = createHttpPublicWatersSource(get);
    await expect(src.getPublicWaterByLinkCode('R:RO11_01.018_R1')).resolves.toBeNull();
    expect(calls[0].path).toBe('water/R%3ARO11_01.018_R1');
  });

  it('a shape the page does not know throws', async () => {
    const { get } = fakeGet([[{ id: 'x' }]]);
    await expect(createHttpPublicWatersSource(get).searchPublicWaters('snag')).rejects.toThrow();
  });

  it('search below 2 characters makes no request', async () => {
    const { get, calls } = fakeGet([]);
    await expect(createHttpPublicWatersSource(get).searchPublicWaters(' s ')).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
    expect(publicWaterSearchQuery(createHttpPublicWatersSource(get), 's').enabled).toBe(false);
    expect(publicWaterSearchQuery(createHttpPublicWatersSource(get), 'Snag').queryKey).toEqual(publicWaterSourceKeys.search('snag'));
  });

  it('centroids round-trip through the compact tuple form', async () => {
    const rows = [
      { id: 1, type: 'river' as const, countyId: null, lat: 45, lng: 25 },
      { id: 2, type: 'reservoir_lake' as const, countyId: 7, lat: 46, lng: 26 },
    ];
    expect(decodeCentroids(encodeCentroids(rows))).toEqual(rows);
    const { get } = fakeGet([encodeCentroids(rows)]);
    await expect(createHttpPublicWatersSource(get).getAllCentroids()).resolves.toEqual(rows);
  });
});
