import { describe, it, expect } from 'vitest';
import {
  buildDashboardPartideSection,
  buildWeightSegments,
  endReachedTarget,
  lakeCardToVenue,
  publicWaterToVenue,
  shouldShowLiveHeader,
  venueHref,
} from '../communityView';
import type { CommunityHistorySessionDTO, CommunityVenueDTO } from '../../schemas';

describe('venueHref', () => {
  it('routes lakes to lake detail', () => {
    expect(venueHref({ venueType: 'lake', lakeId: 'abc' })).toBe('/lakes/abc');
  });
  it('routes lakes by lakeId even when venueType is absent (older CMS)', () => {
    expect(venueHref({ lakeId: 'abc' })).toBe('/lakes/abc');
  });
  it('routes public waters with a code', () => {
    expect(venueHref({ venueType: 'publicWater', lakeId: null, publicWaterCode: 'ROLA1' })).toBe('/public-waters/ROLA1');
  });
  it('returns null for pins, code-less waters, and older CMS without lakeId', () => {
    expect(venueHref({ venueType: 'pin', lakeId: null })).toBeNull();
    expect(venueHref({ venueType: 'publicWater', lakeId: null, publicWaterCode: null })).toBeNull();
    expect(venueHref({ lakeId: null })).toBeNull();
  });
});

describe('buildWeightSegments', () => {
  const c = (clientId: string, species: string | null, weightKg: number | null) => ({ clientId, species, weightKg });

  it('returns [] when no catch is weighed', () => {
    expect(buildWeightSegments([c('a', 'Crap', null), c('b', 'Caras', 0)])).toEqual([]);
  });

  it('aggregates per species, sorts desc and computes fractions summing to 1', () => {
    const segs = buildWeightSegments([c('a', 'Caras', 2.1), c('b', 'Crap', 3.4), c('c', 'Caras', 1.2)]);
    expect(segs.map(s => s.key)).toEqual(['Crap', 'Caras']);
    expect(segs[0].label).toBe('Crap 3,4');
    expect(segs[1].label).toBe('Caras 3,3');
    expect(segs[1].weightKg).toBeCloseTo(3.3);
    expect(segs.reduce((t, s) => t + s.fraction, 0)).toBeCloseTo(1);
  });

  it('collapses 4th+ species into an "altele" segment', () => {
    const segs = buildWeightSegments([c('a', 'A', 4), c('b', 'B', 3), c('c', 'C', 2), c('d', 'D', 1), c('e', 'E', 0.5)]);
    expect(segs).toHaveLength(4);
    expect(segs[3].label).toBe('altele');
    expect(segs[3].weightKg).toBeCloseTo(1.5);
  });

  it('groups species-less catches under "Captură"', () => {
    const segs = buildWeightSegments([c('a', null, 2), c('b', null, 1)]);
    expect(segs).toHaveLength(1);
    expect(segs[0].label).toBe('Captură 3,0');
  });
});

describe('buildDashboardPartideSection', () => {
  const venue = (key: string): CommunityVenueDTO => ({
    key,
    venueType: 'lake',
    lakeId: null,
    name: `Venue ${key}`,
    locality: null,
    imageUrl: null,
    sessions: [],
  });

  const historyRow = (documentId: string): CommunityHistorySessionDTO => ({
    documentId,
    startedAt: '2026-07-01T00:00:00.000Z',
    endedAt: '2026-07-01T02:00:00.000Z',
    members: [],
    venue: { key: 'v1', venueType: 'lake', lakeId: null, name: 'Lake', locality: null, imageUrl: null },
    catchCount: 0,
    maxKg: null,
    totalKg: null,
    photoUrl: null,
  });

  it('shows live venues when any exist, capped at 5, ignoring history entirely', () => {
    const venues = Array.from({ length: 7 }, (_, i) => venue(`v${i}`));
    const history = [historyRow('h1'), historyRow('h2')];

    const result = buildDashboardPartideSection(venues, history);

    expect(result.kind).toBe('live');
    if (result.kind !== 'live') throw new Error('unreachable');
    expect(result.venues).toHaveLength(5);
    expect(result.venues.map(v => v.key)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
  });

  it('never returns finished rows alongside live venues, even when history is non-empty', () => {
    // A plausible broken implementation computes both independently
    // (`{ kind: 'live', venues: live, rows: finished }`) instead of gating
    // `finished` on `live.length === 0`. This catches that: the result must
    // carry no `rows` key at all when venues are live.
    const result = buildDashboardPartideSection([venue('v1')], [historyRow('h1'), historyRow('h2')]);
    expect(result.kind).toBe('live');
    expect('rows' in result).toBe(false);
  });

  it('falls back to the 3 most recent finished sessions when nothing is live', () => {
    const history = [historyRow('h1'), historyRow('h2'), historyRow('h3'), historyRow('h4'), historyRow('h5')];

    const result = buildDashboardPartideSection([], history);

    expect(result.kind).toBe('finished');
    if (result.kind !== 'finished') throw new Error('unreachable');
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map(r => r.documentId)).toEqual(['h1', 'h2', 'h3']);
  });

  it('does not pad the finished fallback when fewer than 3 rows are available', () => {
    const result = buildDashboardPartideSection([], [historyRow('h1'), historyRow('h2')]);

    expect(result.kind).toBe('finished');
    if (result.kind !== 'finished') throw new Error('unreachable');
    expect(result.rows).toHaveLength(2);
  });

  it('returns empty when there is neither a live venue nor a finished session', () => {
    expect(buildDashboardPartideSection([], [])).toEqual({ kind: 'empty' });
  });

  it('never returns live venues alongside a finished-only history query, even with a stale empty venues array', () => {
    // A plausible broken implementation short-circuits to 'finished' whenever
    // `historyRows` is non-empty, without checking `venues` first — this
    // would incorrectly hide genuinely live venues behind history noise.
    const result = buildDashboardPartideSection([venue('v1'), venue('v2')], [historyRow('h1')]);
    expect(result.kind).toBe('live');
    if (result.kind !== 'live') throw new Error('unreachable');
    expect(result.venues).toHaveLength(2);
  });
});

describe('endReachedTarget (spec 2026-07-28 addendum: bounding the live feed)', () => {
  it('in liveOnly mode, pages LIVE when it has a next page', () => {
    expect(endReachedTarget({ liveOnly: true, liveHasNextPage: true, historyHasNextPage: true })).toBe('live');
  });

  it('in liveOnly mode, does nothing once live has no further page — history is never paged, even if it has one', () => {
    expect(endReachedTarget({ liveOnly: true, liveHasNextPage: false, historyHasNextPage: true })).toBe('none');
  });

  it('in default mode, pages HISTORY when it has a next page', () => {
    expect(endReachedTarget({ liveOnly: false, liveHasNextPage: true, historyHasNextPage: true })).toBe('history');
  });

  it('in default mode, does nothing once history has no further page — live is never paged, even if it has one', () => {
    expect(endReachedTarget({ liveOnly: false, liveHasNextPage: true, historyHasNextPage: false })).toBe('none');
  });

  it('is none/none-safe: both queries exhausted in either mode', () => {
    expect(endReachedTarget({ liveOnly: true, liveHasNextPage: false, historyHasNextPage: false })).toBe('none');
    expect(endReachedTarget({ liveOnly: false, liveHasNextPage: false, historyHasNextPage: false })).toBe('none');
  });
});

describe('lakeCardToVenue (Explorează venue picker: catalog lake → community venue key)', () => {
  it('maps a lake card to the CMS venueKeyOf format (lake:<documentId>) with its display name', () => {
    expect(lakeCardToVenue({ documentId: 'abc123', name: 'Balta Corbu' })).toEqual({
      key: 'lake:abc123',
      name: 'Balta Corbu',
    });
  });

  it('rejects a lake without a documentId — a key of "lake:" would match nothing server-side', () => {
    expect(lakeCardToVenue({ name: 'Balta Corbu' })).toBeNull();
    expect(lakeCardToVenue({ documentId: null, name: 'Balta Corbu' })).toBeNull();
    expect(lakeCardToVenue({ documentId: '', name: 'Balta Corbu' })).toBeNull();
  });
});

describe('publicWaterToVenue (Explorează venue picker: ANAR water → community venue key)', () => {
  it('maps a linkCoded water to the CMS venueKeyOf format (water:<code>)', () => {
    expect(publicWaterToVenue({ linkCode: 'ROLW123', name: 'Dunărea' })).toEqual({
      key: 'water:ROLW123',
      name: 'Dunărea',
    });
  });

  it('falls back to "Apă publică" for a nameless water (mirrors venueKeyOf)', () => {
    expect(publicWaterToVenue({ linkCode: 'ROLW123', name: null })).toEqual({
      key: 'water:ROLW123',
      name: 'Apă publică',
    });
  });

  it('rejects waters without a linkCode — no stable ref to filter on (same rule as the start flow)', () => {
    expect(publicWaterToVenue({ linkCode: null, name: 'Pârâu fără cod' })).toBeNull();
  });
});

describe('shouldShowLiveHeader (review round 2, Important 2: the escape hatch must not hide itself)', () => {
  it('shows the header when there are filtered live rows, regardless of further pages', () => {
    expect(shouldShowLiveHeader(3, false)).toBe(true);
  });

  it('shows the header (Vezi toate only) when the chip filter emptied page 1 but more live pages exist', () => {
    // The exact bug: 'Cu notificări' filters page 1 down to zero matches, but
    // page 2+ might still have one — the header (and its Vezi toate escape
    // hatch) must stay reachable.
    expect(shouldShowLiveHeader(0, true)).toBe(true);
  });

  it('hides the header when there is genuinely nothing live and nowhere further to look', () => {
    expect(shouldShowLiveHeader(0, false)).toBe(false);
  });
});
