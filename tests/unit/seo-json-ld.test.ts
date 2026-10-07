import { describe, expect, it } from 'vitest';
import type { CommunityStatsDTO, StandStat, TopAngler } from '@/core/partide';
import type { Review } from '@/core/lakes';
import { aggregateRatingJsonLd, breadcrumbListJsonLd, collectionPageJsonLd, jsonLdHtml, mapJsonLd } from '@/lib/json-ld';
import { anglersRankingJsonLd, anglerItems, standItems, standsRankingJsonLd, statsFromState, statsPageJsonLd, totalsLine } from '@/lib/seo/community';
import { reviewsJsonLd } from '@/lib/seo/reviews';

/* global.b.seo-json-ld — the JSON-LD builders: escaping, only what the page shows, Romanian counts. */

const S = 'http://localhost:3000';
const angler = (name: string | null, totalKg: number, over: Partial<TopAngler> = {}): TopAngler => ({ uid: name ?? 'x', name, avatarUrl: null, partide: 1, catches: 2, totalKg, ...over });
const stand = (name: string, totalKg: number, over: Partial<StandStat> = {}): StandStat => ({ standId: name, name, partide: 1, catches: 1, totalKg, recordKg: null, ...over });
const stats = (over: Partial<CommunityStatsDTO> = {}): CommunityStatsDTO => ({
  period: 'month',
  totals: { partide: 21, anglers: 1, catches: 120, totalKg: 50 },
  weeklySeries: [],
  topAnglers: [angler('Ion', 12.5), angler(null, 0)],
  topVenues: [],
  record: null,
  species: [],
  stands: [stand('B', 1), stand('A', 7, { recordKg: 3.25 })],
  ...over,
});
const venue = { type: 'TouristAttraction', name: 'Balta Test', path: '/balti/lk1' };

describe('jsonLdHtml', () => {
  it('escapes < so CMS text can never close the script', () => {
    const html = jsonLdHtml({ name: '</script><script>alert(1)</script>' }).__html;
    expect(html).not.toContain('</script>');
    expect(JSON.parse(html)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});

describe('breadcrumbListJsonLd', () => {
  it('links every step, the last one to the page itself', () => {
    const ld = breadcrumbListJsonLd([{ label: 'Bălți', href: '/balti' }, { label: 'Statistici' }], '/balti/lk1/statistici');
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Bălți', item: `${S}/balti` },
      { '@type': 'ListItem', position: 2, name: 'Statistici', item: `${S}/balti/lk1/statistici` },
    ]);
  });
});

describe('collectionPageJsonLd', () => {
  it('has no ItemList without rows', () => {
    const ld = collectionPageJsonLd({ name: 'Partide · Balta', path: '/balti/lk1/partide', about: venue, list: { name: 'x', items: [] } });
    expect(ld).not.toHaveProperty('mainEntity');
    expect(ld).toMatchObject({ '@type': 'CollectionPage', url: `${S}/balti/lk1/partide`, about: { '@type': 'TouristAttraction', url: `${S}/balti/lk1` } });
  });
});

describe('community rankings', () => {
  it('anglers: page order, «Pescar» for a nameless angler, no kg when nothing was weighed', () => {
    expect(anglerItems(stats())).toEqual([
      { name: 'Ion', description: '12,50 kg · 1 partidă · 2 capturi' },
      { name: 'Pescar', description: '1 partidă · 2 capturi' },
    ]);
    const ld = anglersRankingJsonLd('Clasament pescari · Balta Test', '/balti/lk1/clasament', venue, stats());
    expect(ld.mainEntity?.itemListElement.map(i => i.position)).toEqual([1, 2]);
  });

  it('stands: by kg (the canonical sort), the record when there is one', () => {
    expect(standItems(stats()).map(s => s.name)).toEqual(['A', 'B']);
    expect(standItems(stats())[0].description).toBe('7,00 kg · 1 partidă · 1 captură · record 3,25 kg');
  });

  it('totals with Romanian plurals («de» from 20)', () => {
    expect(totalsLine(stats())).toBe('21 de partide, 1 pescar, 120 de capturi');
  });

  it('an empty period: no description, no list (rule 4)', () => {
    const empty = stats({ totals: { partide: 0, anglers: 0, catches: 0, totalKg: 0 }, topAnglers: [], stands: [] });
    const page = statsPageJsonLd('Statistici · Balta Test', '/balti/lk1/statistici', venue, empty);
    expect(page).not.toHaveProperty('description');
    expect(page).not.toHaveProperty('mainEntity');
    expect(standsRankingJsonLd('x', '/x', venue, empty)).not.toHaveProperty('mainEntity');
    expect(anglersRankingJsonLd('x', '/x', venue, null)).not.toHaveProperty('mainEntity');
  });

  it('reads the stats from the dehydrated query, null when the read failed', () => {
    expect(statsFromState({ mutations: [], queries: [] })).toBeNull();
    const s = stats();
    expect(statsFromState({ mutations: [], queries: [{ queryKey: ['x'], queryHash: 'x', dehydratedAt: 0, state: { data: s } as never }] })).toBe(s);
  });

  it('never says «capot»', () => {
    const text = JSON.stringify([statsPageJsonLd('x', '/x', venue, stats()), standsRankingJsonLd('x', '/x', venue, stats())]);
    expect(text.toLowerCase()).not.toContain('capot');
  });
});

describe('reviewsJsonLd', () => {
  const review = (over: Partial<Review> = {}): Review => ({
    documentId: 'r1',
    quality: 5,
    facilities: 4,
    atmosphere: 3,
    recommendToOthers: true,
    comment: '  Foarte bine  ',
    createdAt: '2026-09-01T10:00:00Z',
    author: { documentId: 'a1', username: 'Ion', avatar: null },
    ...over,
  });

  it('nothing for a lake without reviews', () => {
    expect(reviewsJsonLd({ documentId: 'lk1', name: 'B', reviewsMeta: null }, '/balti/lk1/recenzii', [])).toBeNull();
    expect(reviewsJsonLd({ documentId: 'lk1', name: 'B', reviewsMeta: { quality: 0, facilities: 0, atmosphere: 0, count: 0 } }, '/balti/lk1/recenzii', [])).toBeNull();
  });

  it('the lake with the mean of its three scores and the listed reviews', () => {
    const ld = reviewsJsonLd({ documentId: 'lk1', name: 'B', reviewsMeta: { quality: 5, facilities: 4, atmosphere: 3, count: 7 } }, '/balti/lk1/recenzii', [
      review(),
      review({ documentId: 'r2', comment: null, author: null }),
    ])!;
    expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: 4, ratingCount: 7, bestRating: 5, worstRating: 1 });
    expect(ld.review[0]).toMatchObject({ author: { name: 'Ion' }, reviewBody: 'Foarte bine', reviewRating: { ratingValue: 4 } });
    expect(ld.review[1]).not.toHaveProperty('reviewBody');
    expect(ld.review[1].author.name).toBe('Pescar');
  });

  it('aggregateRatingJsonLd refuses a zero count or score', () => {
    expect(aggregateRatingJsonLd(4, 0)).toBeNull();
    expect(aggregateRatingJsonLd(0, 3)).toBeNull();
  });
});

describe('mapJsonLd', () => {
  it('a Map about the place, with coordinates only when given', () => {
    expect(mapJsonLd({ name: 'Hartă · B', path: '/balti/lk1/harta', place: { type: 'TouristAttraction', name: 'B', path: '/balti/lk1', lat: 44, lng: 26 } }).about).toEqual({
      '@type': 'TouristAttraction',
      name: 'B',
      url: `${S}/balti/lk1`,
      geo: { '@type': 'GeoCoordinates', latitude: 44, longitude: 26 },
    });
    expect(mapJsonLd({ name: 'x', path: '/x', place: { type: 'Place', name: 'x', path: '/y' } }).about).not.toHaveProperty('geo');
  });
});
