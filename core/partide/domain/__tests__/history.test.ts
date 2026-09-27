import { describe, it, expect } from 'vitest';
import { groupSessionsByMonth } from '../history';
import type { LocalSession } from '../types';

const DAY = 86_400_000;

const mkSession = (over: Partial<LocalSession>): LocalSession => ({
  clientId: 's1', serverId: null, syncStatus: 'synced', clientUpdatedAt: 1,
  venueType: 'lake', lakeId: 'lake-9', lakeName: 'Roveng', publicWaterCode: null,
  publicWaterName: null, manualVenueName: null, standId: null, standName: null,
  locality: null,
  anchorLat: 44.4300, anchorLng: 26.0100, anchorName: null,
  startedAt: new Date(2025, 8, 10).getTime(), endedAt: new Date(2025, 8, 10).getTime() + DAY,
  warnedAt: null, autoCloseAt: null,
  plannedDurationMs: DAY, notes: null, visibleOnProfile: true, targetSpecies: [], rods: [], rodRuntimes: [], detailsHydrated: true,
  projectionRev: 0, ...over,
});

describe('groupSessionsByMonth', () => {
  it('excludes the active (unended) session', () => {
    const active = mkSession({ clientId: 'active', endedAt: null });
    const ended = mkSession({ clientId: 'ended' });
    const groups = groupSessionsByMonth([active, ended]);
    const allIds = groups.flatMap(g => g.sessions.map(s => s.clientId));
    expect(allIds).toEqual(['ended']);
  });

  it('splits sessions into separate groups by calendar month, newest month first', () => {
    const sep = mkSession({ clientId: 'sep', startedAt: new Date(2025, 8, 10).getTime() });
    const aug = mkSession({ clientId: 'aug', startedAt: new Date(2025, 7, 20).getTime() });
    const groups = groupSessionsByMonth([aug, sep]);
    expect(groups.map(g => g.title)).toEqual(['SEPTEMBRIE 2025', 'AUGUST 2025']);
    expect(groups.map(g => g.sessions.map(s => s.clientId))).toEqual([['sep'], ['aug']]);
  });

  it('orders sessions within a month newest-first', () => {
    const early = mkSession({ clientId: 'early', startedAt: new Date(2025, 8, 5).getTime() });
    const late = mkSession({ clientId: 'late', startedAt: new Date(2025, 8, 20).getTime() });
    const groups = groupSessionsByMonth([early, late]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map(s => s.clientId)).toEqual(['late', 'early']);
  });
});
