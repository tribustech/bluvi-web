import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nearestCountyTo } from './nearestCounty';

function db(rows: { lat: number; lng: number; county: string | null; link: string | null }[]) {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE fishing_waters (id INTEGER PRIMARY KEY, county TEXT, center_lat REAL, center_lng REAL, link_code TEXT)');
  const ins = d.prepare('INSERT INTO fishing_waters (county, center_lat, center_lng, link_code) VALUES (?, ?, ?, ?)');
  for (const r of rows) ins.run(r.county, r.lat, r.lng, r.link);
  return d;
}

describe('nearestCountyTo (fish features/public-waters/queries.ts)', () => {
  it('skips the nearest waters without a county, however many, and finds the next one with one', () => {
    const near = Array.from({ length: 6 }, (_, i) => ({ lat: 45 + i * 0.001, lng: 25, county: null, link: `L${i}` }));
    const d = db([...near, { lat: 45.5, lng: 25, county: 'Brasov', link: null }, { lat: 47, lng: 25, county: 'Cluj', link: 'X' }]);
    // The five nearest linked waters have no county; the county row has no link_code: fish still finds it.
    expect(nearestCountyTo(d, 45, 25)).toBe('Brașov');
  });

  it('orders by plain degree distance, like fish (no cosLat weight)', () => {
    // East 0.3° vs north 0.25°: unweighted the north one is nearer (0.0625 < 0.09);
    // cosLat(46°)≈0.69 would flip it (0.043 < 0.0625).
    const d = db([
      { lat: 46, lng: 25.3, county: 'Covasna', link: 'A' },
      { lat: 46.25, lng: 25, county: 'Harghita', link: 'B' },
    ]);
    expect(nearestCountyTo(d, 46, 25)).toBe('Harghita');
  });

  it('is null on a table with no county at all', () => {
    expect(nearestCountyTo(db([{ lat: 45, lng: 25, county: null, link: 'A' }]), 45, 25)).toBeNull();
  });
});
