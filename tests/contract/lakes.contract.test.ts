import { describe, expect, it } from 'vitest';
import type { Transport } from '@/core/transport';
import {
  EMPTY_LAKE_FILTERS,
  DEFAULT_LAKES_COMMITTED_SEARCH,
  getClaimedPublicWaters,
  getFacilities,
  getFilteredLakes,
  getFilteredLakesCount,
  getFishes,
  getLake,
  getLakeMapClusterLeaves,
  getLakeMapClusters,
  getLakeOperatorStats,
  getLakes,
  getLakesByDocumentIds,
  getLakesExploreCount,
  getLakesExploreSuggestions,
  getLakesFocusBbox,
  getLakesHome,
  getLakesInBbox,
  getLakesIndex,
  getOwnedLakesStats,
  getReviewForLakeByAuthorId,
  getReviewsForLake,
  type LakeFilterValues,
} from '@/core/lakes';
import { getUserReputation } from '@/core/social';
import { contractContext, expectDenied } from './context';

const { guest, user, userDocumentId } = contractContext();

/** Local Chita Lake — owned by the QA user. */
const CHITA = 's84u55lo4n9z0emngozttt6e';
const ROMANIA = { north: 48.3, south: 43.6, east: 29.7, west: 20.2 };

/**
 * `/lakes/home`, `/lakes/explore/{suggestions,count}`, `/lakes/in-bbox` and `/lakes/focus-bbox` are
 * public reads (`auth: 'none'`, edge-cached; staging answers all five anonymously with 200), but the
 * LOCAL Public role lacks the `lake.home` / `lake.exploreSuggestions` / `lake.exploreCount` /
 * `lake.inBbox` / `lake.focusBbox` grants, so an anonymous call answers 403 here. To still validate
 * the schemas against real data, this transport forces the QA user's JWT onto them.
 */
const userForced: Transport = { request: req => user.request({ ...req, auth: 'optional' }) };

describe('lakes — /feed/lakes', () => {
  it('opens every lake in the index (guest) and Chita as user', async () => {
    const index = await getLakesIndex(guest);
    expect(index.length).toBeGreaterThan(0);
    for (const row of index) {
      const detail = await getLake(guest, row.documentId);
      expect(detail.documentId).toBe(row.documentId);
    }
    const chita = await getLake(user, CHITA);
    expect(chita.name).toBe('Chita Lake');
    expect(chita.hasOwner).toBe(true);
  });

  it('pages the whole search list, searches by name and resolves by ids', async () => {
    for (const t of [guest, user]) {
      let page = 1;
      let pageCount = 1;
      const ids: string[] = [];
      do {
        const res = await getLakes(t, { page, pageSize: 50 });
        pageCount = res.meta.pagination.pageCount;
        ids.push(...res.data.map(l => l.documentId));
        page += 1;
      } while (page <= pageCount);
      expect(ids.length).toBeGreaterThan(0);

      const hit = await getLakes(t, { search: 'chita', pageSize: 5 });
      expect(hit.data.map(l => l.documentId)).toContain(CHITA);

      const byIds = await getLakesByDocumentIds(t, [CHITA, ids[0]]);
      expect(byIds.map(l => l.documentId)[0]).toBe(CHITA);
    }
  });

  it('filters lakes and counts them', async () => {
    const [fishes, facilities] = await Promise.all([getFishes(guest), getFacilities(guest)]);
    const filters: LakeFilterValues = {
      ...EMPTY_LAKE_FILTERS,
      selectedFish: fishes.slice(0, 2).map(f => ({ id: f.documentId, name: f.Name, documentId: f.documentId })),
      selectedFacilities: facilities.slice(0, 1).map(f => ({ id: f.documentId, name: f.name, documentId: f.documentId })),
    };
    for (const t of [guest, user]) {
      const all = await getFilteredLakes(t, { page: 1, pageSize: 100 });
      expect(all.meta.pagination.total).toBeGreaterThan(0);
      const narrowed = await getFilteredLakes(t, { page: 1, pageSize: 100, filters });
      expect(narrowed.meta.pagination.total).toBeLessThanOrEqual(all.meta.pagination.total);
      const count = await getFilteredLakesCount(userForced, { filters: { ...filters, ratingTier: 'good', bookableOnly: true } });
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it('reads a lake’s reviews (guest and user) and my review (user only)', async () => {
    for (const t of [guest, user]) {
      const res = await getReviewsForLake(t, CHITA, { page: 1, pageSize: 10 });
      expect(res.meta.pagination.page).toBe(1);
    }
    const mine = await getReviewForLakeByAuthorId(user, { lakeId: CHITA });
    expect(mine === null || typeof mine.documentId === 'string').toBe(true);
    await expectDenied(getReviewForLakeByAuthorId(guest, { lakeId: CHITA }));
  });

});

describe('lakes — map viewport', () => {
  it('clusters the country at several zooms and opens every cluster’s leaves', async () => {
    for (const t of [guest, user]) {
      for (const zoom of [6, 9, 12, 16]) {
        const res = await getLakeMapClusters(t, { ...ROMANIA, zoom, filters: { ...EMPTY_LAKE_FILTERS, ratingTier: null } });
        expect(res.meta.zoom).toBe(zoom);
        if (zoom === 16) expect(res.data.some(n => n.type === 'lake')).toBe(true);
        if (zoom === 6 && t === guest) {
          for (const node of res.data) {
            if (node.type !== 'cluster') continue;
            const leaves = await getLakeMapClusterLeaves(t, { ...ROMANIA, zoom, clusterId: node.clusterId });
            expect(leaves.data.length).toBe(node.count);
          }
        }
      }
    }
  });

  it('pages lakes in a bbox (user JWT forced — see `userForced`)', async () => {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 30) {
      const res = await getLakesInBbox(userForced, { ...ROMANIA, page, pageSize: 7 });
      hasMore = res.meta.hasMore;
      page += 1;
    }
    expect(page).toBeGreaterThan(2);
  });

  it('frames a county (user JWT forced — see `userForced`)', async () => {
    const suggestions = await getLakesExploreSuggestions(userForced, { page: 1, pageSize: 20 });
    const county = suggestions.suggestions.find(s => s.type === 'county' && s.countyId);
    expect(county).toBeDefined();
    const res = await getLakesFocusBbox(userForced, { countyId: county!.countyId });
    expect(res.count).toBeGreaterThan(0);
    expect(res.bbox).not.toBeNull();
  });

  it.skip('home / explore / in-bbox / focus-bbox as a true guest — local Public role lacks those five grants (403); staging answers 200 anonymously', () => {});
});

describe('lakes — explore + home', () => {
  it('suggests and counts (default, text, filtered, nearby) — user JWT forced', async () => {
    for (const t of [userForced]) {
      const def = await getLakesExploreSuggestions(t, { page: 1, pageSize: 20 });
      expect(def.suggestions.length).toBeGreaterThan(0);
      const text = await getLakesExploreSuggestions(t, { q: 'bu', page: 1, pageSize: 20 });
      expect(text.meta.query).toBe('bu');
      const page2 = await getLakesExploreSuggestions(t, { q: 'a', page: 2, pageSize: 20 });
      expect(page2.meta.pagination.page).toBe(2);
      await getLakesExploreSuggestions(t, { mode: 'nearby', latitude: 44.43, longitude: 26.1, radiusKm: 50, filters: { ...EMPTY_LAKE_FILTERS, bookableOnly: true } });

      expect(await getLakesExploreCount(t)).toBeGreaterThan(0);
      const lakeSuggestion = text.suggestions.find(s => s.type === 'county') ?? def.suggestions.find(s => s.type === 'county');
      const byCounty = await getLakesExploreCount(t, {
        search: { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'county', query: lakeSuggestion!.title, countyId: lakeSuggestion!.countyId ?? null },
      });
      expect(byCounty).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds the home sections with and without a location — user JWT forced', async () => {
    for (const t of [userForced]) {
      const plain = await getLakesHome(t, { limit: 10 });
      expect(plain.length).toBeGreaterThan(0);
      const located = await getLakesHome(t, { limit: 10, latitude: 44.4268, longitude: 26.1025, radiusKm: 50 });
      expect(located.some(s => s.key === 'nearby')).toBe(true);
    }
  });
});

describe('lakes — catalogs + public waters', () => {
  it('lists facilities, fishes and the claimed public waters', async () => {
    for (const t of [guest, user]) {
      expect((await getFacilities(t)).length).toBeGreaterThan(0);
      expect((await getFishes(t)).length).toBeGreaterThan(0);
      expect(Array.isArray(await getClaimedPublicWaters(t))).toBe(true);
    }
  });
});

describe('lakes — reputation', () => {
  it('reads the QA user’s and a reviewer’s reputation', async () => {
    const reviews = await getReviewsForLake(guest, CHITA, { page: 1, pageSize: 10 });
    const ids = [userDocumentId, ...reviews.data.map(r => r.author?.documentId).filter((x): x is string => !!x)];
    for (const t of [guest, user]) {
      for (const id of ids) {
        const rep = await getUserReputation(t, id);
        expect(rep.ratingCount).toBe(rep.reviews.length);
      }
    }
  });
});

describe('lakes — operator stats', () => {
  it('owned-lakes stats: user OK, guest denied', async () => {
    const stats = await getOwnedLakesStats(user);
    expect(stats.reservationsByDay).toHaveLength(7);
    await expectDenied(getOwnedLakesStats(guest));
  });

  it('per-lake stats for every window: owner OK, guest denied', async () => {
    const bare = await getLakeOperatorStats(user, CHITA);
    expect(bare.occupancyByDay.length).toBeGreaterThan(0);
    for (const window of ['week', 'month', 'year'] as const) {
      const res = await getLakeOperatorStats(user, CHITA, window);
      expect(res.days?.length).toBeGreaterThan(0);
    }
    await expectDenied(getLakeOperatorStats(guest, CHITA));
  });
});
