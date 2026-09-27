import { describe, it, expect } from 'vitest';
import { openHistoryEntries } from '../historyView';
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

describe('openHistoryEntries', () => {
  it('returns only never-ended sessions', () => {
    const open = mkSession({ clientId: 'open', endedAt: null });
    const ended = mkSession({ clientId: 'ended' });
    const entries = openHistoryEntries([open, ended], {});
    expect(entries.map(e => e.session.clientId)).toEqual(['open']);
  });

  it('orders open sessions newest-first', () => {
    const early = mkSession({ clientId: 'early', endedAt: null, startedAt: new Date(2025, 8, 5).getTime() });
    const late = mkSession({ clientId: 'late', endedAt: null, startedAt: new Date(2025, 8, 20).getTime() });
    const entries = openHistoryEntries([early, late], {});
    expect(entries.map(e => e.session.clientId)).toEqual(['late', 'early']);
  });

  it('synthesizes the aggregate from summary fields for a summary-only row', () => {
    const open = mkSession({
      clientId: 'open',
      endedAt: null,
      detailsHydrated: false,
      summaryCaptures: 13,
      summaryRecordKg: 25.75,
      summaryTotalKg: 101.3,
    });
    const [entry] = openHistoryEntries([open], {});
    expect(entry.agg.captures).toBe(13);
    expect(entry.agg.recordKg).toBe(25.75);
    expect(entry.agg.totalKg).toBe(101.3);
  });

  it('never marks an open entry as the record holder', () => {
    const open = mkSession({
      clientId: 'open',
      endedAt: null,
      detailsHydrated: false,
      summaryCaptures: 1,
      summaryRecordKg: 99,
      summaryTotalKg: 99,
    });
    const [entry] = openHistoryEntries([open], {});
    expect(entry.isRecord).toBe(false);
  });
});
