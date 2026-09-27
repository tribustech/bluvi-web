import { describe, it, expect } from 'vitest';
import {
  avatarColorFor,
  buildRecordSlots,
  deriveSessionView,
  elapsedRo,
  elapsedRoCompact,
  filterHistoryRows,
  filterVenues,
  firstNameOf,
  initialsOf,
  maxCatch,
  membersLabel,
  periodPhraseFor,
  rankColor,
  recordTagFor,
  relativeRo,
  sessionTotalKg,
} from '../communityView';
import type {
  CommunityActiveSessionDTO,
  CommunityHistorySessionDTO,
  CommunityMemberDTO,
  CommunityRecordDTO,
  CommunitySessionDetailCatchDTO,
  CommunitySessionDetailDTO,
  CommunityVenueDTO,
} from '../../schemas';

const member = (over: Partial<CommunityMemberDTO> = {}): CommunityMemberDTO => ({
  uid: 'u' + Math.random(),
  name: 'Radu Popescu',
  avatarUrl: null,
  ...over,
});

const session = (over: Partial<CommunityActiveSessionDTO> = {}): CommunityActiveSessionDTO => ({
  documentId: 's' + Math.random(),
  startedAt: new Date().toISOString(),
  members: [member()],
  catchCount: 0,
  maxKg: null,
  ...over,
});

const venue = (over: Partial<CommunityVenueDTO> = {}): CommunityVenueDTO => ({
  key: 'v1',
  venueType: 'lake',
  lakeId: 'lake-1',
  name: 'Vidraru',
  locality: null,
  imageUrl: null,
  sessions: [session()],
  ...over,
});

describe('filterVenues', () => {
  const followedSession = session({ documentId: 'followed-1' });
  const unfollowedSession = session({ documentId: 'not-followed-1' });
  const friendMember = member({ uid: 'friend-uid' });
  const strangerMember = member({ uid: 'stranger-uid' });
  const friendSession = session({ documentId: 'friend-session', members: [strangerMember, friendMember] });
  const strangerSession = session({ documentId: 'stranger-session', members: [strangerMember] });

  const venues: CommunityVenueDTO[] = [
    venue({ key: 'v1', sessions: [followedSession, unfollowedSession] }),
    venue({ key: 'v2', sessions: [strangerSession] }),
    venue({ key: 'v3', sessions: [friendSession] }),
  ];

  it('"active" chip keeps every session untouched', () => {
    const result = filterVenues(venues, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
    });
    expect(result).toHaveLength(3);
    expect(result.find(v => v.key === 'v1')?.sessions).toHaveLength(2);
  });

  it('"urmarite" chip keeps only followed sessions and drops emptied venues', () => {
    const result = filterVenues(venues, {
      chip: 'urmarite',
      followedSessionIds: new Set(['followed-1']),
      followedAnglerUids: new Set(),
    });
    // v1 keeps only the followed session; v2/v3 have no followed sessions and are dropped.
    expect(result.map(v => v.key)).toEqual(['v1']);
    expect(result[0].sessions.map(s => s.documentId)).toEqual(['followed-1']);
  });

  it('"prieteni" chip keeps sessions with at least one followed member, drops the rest', () => {
    const result = filterVenues(venues, {
      chip: 'prieteni',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(['friend-uid']),
    });
    expect(result.map(v => v.key)).toEqual(['v3']);
    expect(result[0].sessions.map(s => s.documentId)).toEqual(['friend-session']);
  });

  it('narrows by venueKeys before applying the chip filter', () => {
    const result = filterVenues(venues, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: ['v2'],
    });
    expect(result.map(v => v.key)).toEqual(['v2']);
  });

  it('narrows by multiple venueKeys, preserving original order', () => {
    const result = filterVenues(venues, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: ['v3', 'v1'],
    });
    expect(result.map(v => v.key)).toEqual(['v1', 'v3']);
  });

  it('drops a venue entirely when its key is not among venueKeys', () => {
    const result = filterVenues(venues, {
      chip: 'urmarite',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: ['does-not-exist'],
    });
    expect(result).toEqual([]);
  });

  it('treats an empty venueKeys array as "all venues"', () => {
    const result = filterVenues(venues, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: [],
    });
    expect(result.map(v => v.key)).toEqual(['v1', 'v2', 'v3']);
  });
});

describe('filterHistoryRows', () => {
  const historyRow = (over: Partial<CommunityHistorySessionDTO> = {}): CommunityHistorySessionDTO => ({
    documentId: 'h' + Math.random(),
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
    endedAt: new Date().toISOString(),
    members: [member()],
    venue: { key: 'v1', venueType: 'lake', lakeId: 'lake-1', name: 'Vidraru', locality: null, imageUrl: null },
    catchCount: 2,
    maxKg: 3.2,
    totalKg: 5.4,
    photoUrl: null,
    ...over,
  });

  const friendMember = member({ uid: 'friend-uid' });
  const strangerMember = member({ uid: 'stranger-uid' });

  const followedRow = historyRow({ documentId: 'followed-1', venue: { key: 'v1', venueType: 'lake', lakeId: 'l1', name: 'A', locality: null, imageUrl: null } });
  const unfollowedRow = historyRow({ documentId: 'not-followed-1', venue: { key: 'v1', venueType: 'lake', lakeId: 'l1', name: 'A', locality: null, imageUrl: null } });
  const friendRow = historyRow({ documentId: 'friend-row', members: [strangerMember, friendMember], venue: { key: 'v2', venueType: 'lake', lakeId: 'l2', name: 'B', locality: null, imageUrl: null } });
  const strangerRow = historyRow({ documentId: 'stranger-row', members: [strangerMember], venue: { key: 'v3', venueType: 'lake', lakeId: 'l3', name: 'C', locality: null, imageUrl: null } });

  const rows = [followedRow, unfollowedRow, friendRow, strangerRow];

  it('"active" chip keeps every row untouched', () => {
    const result = filterHistoryRows(rows, { chip: 'active', followedSessionIds: new Set(), followedAnglerUids: new Set() });
    expect(result).toHaveLength(4);
  });

  it('"urmarite" chip keeps only followed rows', () => {
    const result = filterHistoryRows(rows, {
      chip: 'urmarite',
      followedSessionIds: new Set(['followed-1']),
      followedAnglerUids: new Set(),
    });
    expect(result.map(r => r.documentId)).toEqual(['followed-1']);
  });

  it('"prieteni" chip keeps rows with at least one followed member', () => {
    const result = filterHistoryRows(rows, {
      chip: 'prieteni',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(['friend-uid']),
    });
    expect(result.map(r => r.documentId)).toEqual(['friend-row']);
  });

  it('narrows by venueKeys before applying the chip filter', () => {
    const result = filterHistoryRows(rows, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: ['v2', 'v3'],
    });
    expect(result.map(r => r.documentId)).toEqual(['friend-row', 'stranger-row']);
  });

  it('treats an empty venueKeys array as "all venues"', () => {
    const result = filterHistoryRows(rows, {
      chip: 'active',
      followedSessionIds: new Set(),
      followedAnglerUids: new Set(),
      venueKeys: [],
    });
    expect(result).toHaveLength(4);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterHistoryRows(rows, {
      chip: 'urmarite',
      followedSessionIds: new Set(['does-not-exist']),
      followedAnglerUids: new Set(),
    });
    expect(result).toEqual([]);
  });
});

describe('relativeRo', () => {
  const now = new Date('2026-07-21T12:00:00.000Z').getTime();

  it('formats minutes under an hour', () => {
    const iso = new Date(now - 8 * 60_000).toISOString();
    expect(relativeRo(now, iso)).toBe('acum 8m');
  });

  it('formats hours under a day', () => {
    const iso = new Date(now - 2 * 3_600_000).toISOString();
    expect(relativeRo(now, iso)).toBe('acum 2h');
  });

  it('formats days', () => {
    const iso = new Date(now - 3 * 86_400_000).toISOString();
    expect(relativeRo(now, iso)).toBe('acum 3z');
  });
});

describe('elapsedRo', () => {
  const now = new Date('2026-07-21T12:00:00.000Z').getTime();

  it('formats minutes-only under an hour', () => {
    const iso = new Date(now - 45 * 60_000).toISOString();
    expect(elapsedRo(now, iso)).toBe('de 45m');
  });

  it('formats hours and minutes', () => {
    const iso = new Date(now - (2 * 3_600_000 + 14 * 60_000)).toISOString();
    expect(elapsedRo(now, iso)).toBe('de 2h 14m');
  });

  it('formats whole hours without a minutes suffix', () => {
    const iso = new Date(now - 2 * 3_600_000).toISOString();
    expect(elapsedRo(now, iso)).toBe('de 2h');
  });
});

describe('elapsedRoCompact', () => {
  const now = new Date('2026-07-21T12:00:00.000Z').getTime();

  it('formats minutes-only under an hour, same as elapsedRo', () => {
    const iso = new Date(now - 45 * 60_000).toISOString();
    expect(elapsedRoCompact(now, iso)).toBe('de 45m');
  });

  it('drops the minutes remainder once hours >= 1', () => {
    const iso = new Date(now - (2 * 3_600_000 + 14 * 60_000)).toISOString();
    expect(elapsedRoCompact(now, iso)).toBe('de 2h');
  });

  it('formats a long elapsed (22h47m) as just "de 22h"', () => {
    const iso = new Date(now - (22 * 3_600_000 + 47 * 60_000)).toISOString();
    expect(elapsedRoCompact(now, iso)).toBe('de 22h');
  });

  it('formats whole hours identically to elapsedRo', () => {
    const iso = new Date(now - 2 * 3_600_000).toISOString();
    expect(elapsedRoCompact(now, iso)).toBe('de 2h');
  });
});

describe('membersLabel', () => {
  it('returns the single name for one member', () => {
    expect(membersLabel([member({ name: 'Radu P.' })])).toBe('Radu P.');
  });

  it('joins two names with "și"', () => {
    expect(membersLabel([member({ name: 'Tu' }), member({ name: 'Radu' })])).toBe('Tu și Radu');
  });

  it('joins three+ names with a comma list and "și" before the last', () => {
    expect(
      membersLabel([member({ name: 'Mihai' }), member({ name: 'Dan' }), member({ name: 'Ionuț' })])
    ).toBe('Mihai, Dan și Ionuț');
  });

  it('falls back to a "N pescari" count when a name is null', () => {
    expect(membersLabel([member({ name: null }), member({ name: 'Dan' }), member({ name: 'Ionuț' })])).toBe(
      '3 pescari'
    );
  });

  it('uses the singular "1 pescar" fallback for a single member with no name', () => {
    expect(membersLabel([member({ name: null })])).toBe('1 pescar');
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(initialsOf('Radu Popescu')).toBe('RP');
  });

  it('lowercase input is still uppercased', () => {
    expect(initialsOf('radu popescu')).toBe('RP');
  });

  it('returns "?" for null', () => {
    expect(initialsOf(null)).toBe('?');
  });

  it('returns "?" for an empty/whitespace-only string', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });

  it('handles a single-word name', () => {
    expect(initialsOf('Radu')).toBe('R');
  });
});

describe('firstNameOf', () => {
  it('takes the first word of a full name', () => {
    expect(firstNameOf('Andrei Munteanu')).toBe('Andrei');
  });

  it('returns the whole name for a single-word name', () => {
    expect(firstNameOf('Radu')).toBe('Radu');
  });

  it('falls back to "Pescar" for null/blank', () => {
    expect(firstNameOf(null)).toBe('Pescar');
    expect(firstNameOf('   ')).toBe('Pescar');
  });
});

describe('avatarColorFor', () => {
  const PALETTE = ['#F59E0B', '#14B8A6', '#8B5CF6', '#0EA5E9', '#EC4899', '#22C55E'];

  it('is deterministic for the same uid', () => {
    expect(avatarColorFor('angler-42')).toBe(avatarColorFor('angler-42'));
  });

  it('always returns a color from the fixed palette', () => {
    ['a', 'radu-popescu', 'u123', '', 'x'.repeat(50)].forEach(uid => {
      expect(PALETTE).toContain(avatarColorFor(uid));
    });
  });

  it('spreads different uids across more than one color', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(avatarColorFor));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('rankColor', () => {
  it('returns gold/silver/bronze for ranks 1-3', () => {
    expect(rankColor(1)).toBe('#F59E0B');
    expect(rankColor(2)).toBe('#94A3B8');
    expect(rankColor(3)).toBe('#B45309');
  });

  it('returns null for rank 4+', () => {
    expect(rankColor(4)).toBeNull();
    expect(rankColor(11)).toBeNull();
  });
});

describe('recordTagFor', () => {
  it('labels each period', () => {
    expect(recordTagFor('week')).toBe('RECORDUL SĂPTĂMÂNII');
    expect(recordTagFor('month')).toBe('RECORDUL LUNII');
    expect(recordTagFor('year')).toBe('RECORDUL ANULUI');
  });
});

describe('periodPhraseFor', () => {
  it('labels each period for the "Tu" pill copy', () => {
    expect(periodPhraseFor('week')).toBe('săptămâna asta');
    expect(periodPhraseFor('month')).toBe('luna asta');
    expect(periodPhraseFor('year')).toBe('anul asta');
  });
});

describe('sessionTotalKg', () => {
  const c = (weightKg: number | null) => ({
    clientId: 'c' + Math.random(),
    species: null,
    weightKg,
    photoUrl: null,
    occurredAt: '2026-07-20T11:00:00.000Z',
  });

  it('sums weighed catches, skipping null weights', () => {
    expect(sessionTotalKg([c(2.5), c(null), c(1.25)])).toBe(3.75);
  });

  it('returns null when no catch has a weight (or the list is empty)', () => {
    expect(sessionTotalKg([c(null), c(null)])).toBeNull();
    expect(sessionTotalKg([])).toBeNull();
  });

  it('rounds float-addition noise to 2 decimals (0.1 + 0.2 → 0.3)', () => {
    expect(sessionTotalKg([c(0.1), c(0.2)])).toBe(0.3);
  });
});

describe('buildRecordSlots', () => {
  const rec = (window: CommunityRecordDTO['window'], weightKg = 10): CommunityRecordDTO => ({
    window,
    weightKg,
    species: 'Crap',
    venueName: 'Vidraru',
    photoUrl: 'https://cdn/crap.jpg',
    sessionDocumentId: 's1',
    angler: null,
    extraMembers: 0,
  });

  it('maps a full set into today/week/month record slots + stats tile', () => {
    const slots = buildRecordSlots([rec('month'), rec('today'), rec('week')]);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toMatchObject({ kind: 'record', record: { window: 'today' } });
    expect(slots[1]).toMatchObject({ kind: 'record', record: { window: 'week' } });
    expect(slots[2]).toMatchObject({ kind: 'record', record: { window: 'month' } });
    expect(slots[3]).toEqual({ kind: 'stats' });
  });

  it('fills missing windows with invite slots', () => {
    const slots = buildRecordSlots([rec('week')]);
    expect(slots[0]).toEqual({ kind: 'invite', window: 'today' });
    expect(slots[1]).toMatchObject({ kind: 'record' });
    expect(slots[2]).toEqual({ kind: 'invite', window: 'month' });
  });

  it('empty input → three invites + stats', () => {
    expect(buildRecordSlots([])).toEqual([
      { kind: 'invite', window: 'today' },
      { kind: 'invite', window: 'week' },
      { kind: 'invite', window: 'month' },
      { kind: 'stats' },
    ]);
  });

  it('first record per window wins on duplicates', () => {
    const slots = buildRecordSlots([rec('today', 5), rec('today', 9)]);
    expect(slots[0]).toMatchObject({ kind: 'record', record: { weightKg: 5 } });
  });

  // The CMS excludes photoless records, but edge-cached responses from before
  // that deploy can still carry them — they must degrade to the invite tile,
  // never render as a placeholder-photo record.
  it('photoless record degrades to the invite slot (stale-cache guard)', () => {
    const slots = buildRecordSlots([{ ...rec('today'), photoUrl: null }]);
    expect(slots[0]).toEqual({ kind: 'invite', window: 'today' });
  });

  it('a grid-variant-only record still counts as photo-bearing', () => {
    const slots = buildRecordSlots([{ ...rec('today'), photoUrl: null, photoGridUrl: 'https://cdn/grid.jpg' }]);
    expect(slots[0]).toMatchObject({ kind: 'record' });
  });
});

describe('maxCatch', () => {
  const c = (clientId: string, weightKg: number | null) => ({ clientId, weightKg });

  it('returns the first catch matching maxKg', () => {
    const catches = [c('a', 2), c('b', 5.4), c('c', 5.4)];
    expect(maxCatch(catches, 5.4)).toEqual(c('b', 5.4));
  });

  it('returns null when maxKg is null', () => {
    expect(maxCatch([c('a', 2)], null)).toBeNull();
  });

  it('returns null when no catch matches (stale maxKg)', () => {
    expect(maxCatch([c('a', 2)], 9)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(maxCatch([], 3)).toBeNull();
  });

  it('ignores null-weight catches', () => {
    expect(maxCatch([c('a', null), c('b', 3)], 3)).toEqual(c('b', 3));
  });
});

describe('deriveSessionView', () => {
  const catchDto = (over: Partial<CommunitySessionDetailCatchDTO> = {}): CommunitySessionDetailCatchDTO => ({
    clientId: 'c' + Math.random(),
    species: null,
    weightKg: null,
    photoUrl: null,
    occurredAt: '2026-08-01T07:00:00Z',
    ...over,
  });

  const d = (over: Partial<CommunitySessionDetailDTO>): CommunitySessionDetailDTO => ({
    documentId: 'x', startedAt: '2026-08-01T05:00:00Z', endedAt: null, venueName: 'B', locality: null,
    lakeId: null, imageUrl: null, members: [], catchCount: 0, maxKg: null, durationMs: null,
    catches: [], photos: [], weighedCatches: [], maxCatch: null, photoCount: 0, hasMoreCatches: false,
    anglerStats: null, ...over,
  });

  it('derives totals/segments/avg/weighedCount from weighedCatches', () => {
    const v = deriveSessionView(d({ weighedCatches: [
      { t: '2026-08-01T06:00:00Z', kg: 2, species: 'Crap' },
      { t: '2026-08-01T07:00:00Z', kg: 3, species: 'Crap' },
      { t: '2026-08-01T08:00:00Z', kg: 5, species: null },
    ]}));
    expect(v.totalKg).toBe(10);
    expect(v.weighedCount).toBe(3);
    expect(v.avgKg).toBeCloseTo(10 / 3);
    expect(v.segments.map(s => s.key)).toEqual(['Crap', 'Captură']);
    expect(v.evolutionInput).toEqual([
      { weightKg: 2, species: 'Crap', occurredAt: '2026-08-01T06:00:00Z' },
      { weightKg: 3, species: 'Crap', occurredAt: '2026-08-01T07:00:00Z' },
      { weightKg: 5, species: null, occurredAt: '2026-08-01T08:00:00Z' },
    ]);
  });

  it('empty weighedCatches → nulls and empty segments (total shows —)', () => {
    const v = deriveSessionView(d({}));
    expect(v.totalKg).toBeNull();
    expect(v.avgKg).toBeNull();
    expect(v.segments).toEqual([]);
  });

  it('featuredCatch comes from detail.maxCatch verbatim', () => {
    const featured = catchDto({ clientId: 'max1', weightKg: 5.4, photoUrl: 'https://x/max1.jpg' });
    const v = deriveSessionView(d({ maxCatch: featured }));
    expect(v.featuredCatch).toBe(featured);
  });

  describe('lightboxCatches = photos, with photo-bearing maxCatch appended once (dedupe by clientId)', () => {
    it('case A: maxCatch already in photos → no duplicate', () => {
      const shared = catchDto({ clientId: 'shared', photoUrl: 'https://x/shared.jpg' });
      const other = catchDto({ clientId: 'other', photoUrl: 'https://x/other.jpg' });
      const v = deriveSessionView(d({ photos: [other, shared], maxCatch: shared }));
      expect(v.lightboxCatches).toEqual([other, shared]);
    });

    it('case B: maxCatch photo-bearing, outside photos → appended at the end', () => {
      const other = catchDto({ clientId: 'other', photoUrl: 'https://x/other.jpg' });
      const featured = catchDto({ clientId: 'featured', photoUrl: 'https://x/featured.jpg' });
      const v = deriveSessionView(d({ photos: [other], maxCatch: featured }));
      expect(v.lightboxCatches).toEqual([other, featured]);
    });

    it('case C: maxCatch without photo → not appended', () => {
      const other = catchDto({ clientId: 'other', photoUrl: 'https://x/other.jpg' });
      const featured = catchDto({ clientId: 'featured', photoUrl: null });
      const v = deriveSessionView(d({ photos: [other], maxCatch: featured }));
      expect(v.lightboxCatches).toEqual([other]);
    });
  });
});
