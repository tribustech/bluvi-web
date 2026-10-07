import { describe, expect, it } from 'vitest';
import type { SessionDetailDTO, SessionListItemDTO } from '../../schemas';
import { findMineDocument, findMineListItem, historyDetailView, resolveOwnPartidaClientId, selectPartideHistory } from '../historySelectors';

const item = (clientId: string, startedAt: string): SessionListItemDTO => ({
  documentId: `doc-${clientId}`,
  clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: 'L',
  lakeName: 'Chita',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: null,
  anchorLat: 44,
  anchorLong: 26,
  anchorName: null,
  startedAt,
  endedAt: null,
  plannedDurationMs: null,
  notes: null,
  visibleOnProfile: true,
  status: 'finished',
  targetSpecies: [],
  hostUid: 'u1',
  captures: 2,
  recordKg: 3,
  totalKg: 5,
});

describe('historySelectors', () => {
  const mine = { data: [item('a', '2026-09-01T00:00:00Z'), item('b', '2026-09-02T00:00:00Z')], total: 2 };

  it('sorts newest first and excludes only the live session from the render list', () => {
    const { sessions, allSessions } = selectPartideHistory(mine, 'b');
    expect(allSessions.map(s => s.clientId)).toEqual(['b', 'a']);
    expect(sessions.map(s => s.clientId)).toEqual(['a']);
    expect(selectPartideHistory(undefined, null)).toEqual({ sessions: [], allSessions: [] });
  });

  it('resolves list items and own partide', () => {
    expect(findMineListItem(mine, 'a')?.documentId).toBe('doc-a');
    expect(resolveOwnPartidaClientId('doc-b', null, mine)).toBe('b');
    expect(resolveOwnPartidaClientId('live', { documentId: 'live', sessionId: 'x' }, mine)).toBe('x');
    expect(resolveOwnPartidaClientId('other', null, mine)).toBeNull();
    // The web's routes carry the documentId.
    expect(findMineDocument(mine, 'doc-b')?.clientId).toBe('b');
    expect(findMineDocument(mine, 'other')).toBeNull();
    expect(findMineDocument(undefined, 'doc-b')).toBeNull();
  });

  it('falls back to the summary row until the detail loads, then maps events with the roster', () => {
    const summary = historyDetailView('a', mine.data[0], undefined);
    expect(summary.session?.detailsHydrated).toBe(false);
    expect(summary.needsDetail).toBe(true);
    const detail = {
      ...mine.data[0],
      joinCode: null,
      rods: [],
      members: [{ uid: 'u1', name: null, avatar: null, joinedAt: 'x' }],
      events: [
        { id: 2, documentId: 'e2', clientId: 'c2', clientUpdatedAt: null, outcome: 'capture', rodIndex: null, rodLabel: null, rodColor: null, bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: null, lng: null, weightKg: 1, weightEstimated: false, species: 'carp', speciesId: null, photoUrl: null, photoThumbUrl: null, notes: null, occurredAt: '2026-09-01T02:00:00Z', photoTagUids: ['u1'] },
        { id: 1, documentId: 'e1', clientId: 'c1', clientUpdatedAt: null, outcome: 'lost', rodIndex: null, rodLabel: null, rodColor: null, bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: null, lng: null, weightKg: null, weightEstimated: false, species: null, speciesId: null, photoUrl: null, photoThumbUrl: null, notes: null, occurredAt: '2026-09-01T01:00:00Z', photoTagUids: [] },
      ],
    } as SessionDetailDTO;
    const full = historyDetailView('a', mine.data[0], detail);
    expect(full.needsDetail).toBe(false);
    expect(full.session?.detailsHydrated).toBe(true);
    expect(full.events.map(e => e.clientId)).toEqual(['c1', 'c2']);
    // full-roster tags collapse to "Toți"; legacy species literal maps to its name
    expect(full.events[1]).toMatchObject({ photoTagUids: null, species: 'Crap' });
  });
});
