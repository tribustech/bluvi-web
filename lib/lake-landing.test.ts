import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import {
  COUNTIES,
  FEATURES,
  FEATURE_MIN,
  NEIGHBOURS,
  buildLanding,
  clampDescription,
  countyIntro,
  groupFacts,
  lakeCountySlug,
  landingSlug,
  listRo,
  readLandingLakes,
  speciesName,
  type LandingLake,
} from './lake-landing';

let n = 0;
const lake = (over: Partial<LandingLake> = {}): LandingLake => ({
  documentId: `l${++n}`,
  name: `Balta ${n}`,
  county: null,
  countyRef: null,
  cityRef: null,
  regime: null,
  reviewsMeta: null,
  images: [{ url: 'https://x/a.jpg', mediumUrl: null, smallUrl: null }],
  facility: [],
  fishSpecies: [],
  bookingEnabled: false,
  ...over,
});
const fish = (...names: string[]) => names.map((Name, i) => ({ id: i, fish: { documentId: `f-${Name}`, Name } }));
const fac = (...names: string[]) => names.map((name, i) => ({ id: i, name }));
const ref = (name: string) => ({ documentId: `c-${name}`, name });

describe('landingSlug', () => {
  it('strips diacritics (comma and cedilla forms), lowercases and dashes', () => {
    expect(landingSlug('Bistrița-Năsăud')).toBe('bistrita-nasaud');
    expect(landingSlug('Ştiucă')).toBe('stiuca');
    expect(landingSlug('  Satu Mare ')).toBe('satu-mare');
    expect(landingSlug('C&R + Retinere')).toBe('c-r-retinere');
    expect(landingSlug('Crap Oglinda')).toBe('crap-oglinda');
  });
});

describe('counties', () => {
  it('prefers countyRef, falls back to the text, keeps Romanian counties only', () => {
    expect(lakeCountySlug({ county: 'Ilfov', countyRef: ref('Calarasi') })).toBe('calarasi');
    expect(lakeCountySlug({ county: 'Timiș', countyRef: null })).toBe('timis');
    expect(lakeCountySlug({ county: 'Bistrita Nasaud', countyRef: null })).toBe('bistrita-nasaud');
    expect(lakeCountySlug({ county: 'Baranya', countyRef: null })).toBeNull();
    expect(lakeCountySlug({ county: null, countyRef: null })).toBeNull();
  });

  it('lists 42 counties with symmetric neighbours', () => {
    expect(Object.keys(COUNTIES)).toHaveLength(42);
    for (const [a, list] of Object.entries(NEIGHBOURS)) {
      expect(list.length, a).toBeGreaterThan(0);
      for (const b of list) expect(NEIGHBOURS[b], `${a}→${b}`).toContain(a);
    }
    expect(NEIGHBOURS.ilfov).toEqual(['bucuresti', 'calarasi', 'dambovita', 'giurgiu', 'ialomita', 'prahova']);
  });
});

describe('buildLanding', () => {
  const lakes = [
    lake({ countyRef: ref('Ilfov'), fishSpecies: fish('Crap', 'Somn', 'Crap'), regime: 'C&R', facility: fac('Cabane') }),
    lake({ county: 'Ilfov', fishSpecies: fish('Crap'), regime: 'C&R + Retinere', facility: fac('Cabane'), bookingEnabled: true }),
    lake({ county: 'Călărași', fishSpecies: fish('Stiuca'), regime: 'Retinere', facility: fac('Cabane') }),
    lake({ county: 'Baranya', fishSpecies: fish('Crap') }),
  ];

  it('groups by county and species, most lakes first, each lake once', () => {
    const l = buildLanding([...lakes, lakes[0]]);
    expect(l.counties.map((c) => [c.slug, c.name, c.lakes.length])).toEqual([
      ['ilfov', 'Ilfov', 2],
      ['calarasi', 'Călărași', 1],
    ]);
    expect(l.species.map((s) => [s.slug, s.name, s.lakes.length])).toEqual([
      ['crap', 'Crap', 3],
      ['somn', 'Somn', 1],
      ['stiuca', 'Știucă', 1],
    ]);
  });

  it('makes a feature page only from FEATURE_MIN lakes', () => {
    const l = buildLanding(lakes);
    expect(FEATURE_MIN).toBe(3);
    expect(FEATURES.length).toBeLessThanOrEqual(6);
    expect(l.features.map((f) => [f.slug, f.lakes.length])).toEqual([['cu-cazare', 3]]);
  });

  it('orders a group by photo, reviews, rating, then name and id (stable)', () => {
    const a = lake({ name: 'B', county: 'Olt', reviewsMeta: { count: 2, overall: 4, quality: 4, facilities: 4, atmosphere: 4 } });
    const b = lake({ name: 'A', county: 'Olt', reviewsMeta: { count: 5, overall: 3, quality: 3, facilities: 3, atmosphere: 3 } });
    const c = lake({ name: 'C', county: 'Olt', images: [], reviewsMeta: { count: 9, overall: 5, quality: 5, facilities: 5, atmosphere: 5 } });
    const d = lake({ name: 'A', county: 'Olt' });
    const order = buildLanding([c, d, a, b]).counties[0].lakes.map((l) => l.documentId);
    expect(order).toEqual([b, a, d, c].map((l) => l.documentId));
    expect(buildLanding([a, b, c, d]).counties[0].lakes.map((l) => l.documentId)).toEqual(order);
  });
});

describe('intro facts', () => {
  it('says only what the data holds', () => {
    const lakes = [
      lake({ county: 'Ilfov', fishSpecies: fish('Crap', 'Somn'), bookingEnabled: true, reviewsMeta: { count: 3, overall: 5, quality: 5, facilities: 5, atmosphere: 5 } }),
      lake({ county: 'Ilfov', fishSpecies: fish('Crap'), reviewsMeta: { count: 1, overall: 3, quality: 3, facilities: 3, atmosphere: 3 } }),
    ];
    const f = groupFacts(lakes);
    expect(f.topSpecies.map((s) => [s.slug, s.lakes])).toEqual([['crap', 2], ['somn', 1]]);
    expect(f.rating).toBe(4.5);
    expect(countyIntro('ilfov', f)).toBe(
      'Pe Bluvi găsești 2 bălți de pescuit în județul Ilfov. Cele mai întâlnite specii: crap și somn. Una dintre ele se rezervă online, direct pe Bluvi. Nota medie a pescarilor: 4,5 din 5, din 4 recenzii.',
    );
    const bare = groupFacts([lake({ county: 'Olt' })]);
    expect(countyIntro('olt', bare)).toBe('Pe Bluvi găsești o baltă de pescuit în județul Olt.');
  });

  it('formats lists, names and descriptions', () => {
    expect(listRo(['crap', 'caras', 'somn'])).toBe('crap, caras și somn');
    expect(speciesName('ROSIOARA')).toBe('Roșioară');
    expect(speciesName('koi')).toBe('Koi');
    const long = clampDescription('cuvânt '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('readLandingLakes', () => {
  it('walks every page and marks the bookable row', async () => {
    const card = (id: string) => ({ ...lake({ documentId: id }), bookingEnabled: undefined });
    const { transport, calls } = createFakeTransport((req) => {
      if (req.path === '/feed/lakes/filtered') {
        const page = Number(req.query?.page);
        return { data: page === 1 ? [card('b'), card('a')] : [card('c')], meta: { pagination: { page, pageSize: 100, pageCount: 2, total: 3 } } };
      }
      if (req.path === '/lakes/home') return { data: { sections: [{ key: 'bookable', title: 'x', lakes: [{ documentId: 'c', name: 'C', bookingEnabled: true }] }] } };
      throw new Error(req.path);
    });
    const out = await readLandingLakes(transport);
    expect(out.map((l) => [l.documentId, l.bookingEnabled])).toEqual([['a', false], ['b', false], ['c', true]]);
    expect(calls.filter((c) => c.path === '/feed/lakes/filtered').map((c) => c.query?.page)).toEqual([1, 2]);
  });
});
