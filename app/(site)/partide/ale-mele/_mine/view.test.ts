import { describe, expect, it } from 'vitest';
import type { SessionListItemDTO } from '@/core/partide';
import { bestCatchView, hoursView } from '@/components/partide/own/JournalStatCard';
import { aleMeleView } from './view';

const row = (id: string, startedAt: string, endedAt: string | null, captures: number, recordKg: number | null, totalKg: number | null): SessionListItemDTO => ({
  documentId: id,
  clientId: `c-${id}`,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: 'lake',
  lakeName: `Balta ${id}`,
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: null,
  anchorLat: null,
  anchorLong: null,
  anchorName: null,
  startedAt,
  endedAt,
  plannedDurationMs: null,
  notes: null,
  visibleOnProfile: true,
  status: endedAt ? 'finished' : 'active',
  targetSpecies: [],
  captures,
  recordKg,
  totalKg,
}) as SessionListItemDTO;

const NOW = new Date('2026-10-07T12:00:00Z');
const ROWS = [
  row('a', '2026-10-01T06:00:00Z', '2026-10-01T12:00:00Z', 3, 8.2, 14.5),
  row('b', '2026-09-20T06:00:00Z', '2026-09-20T10:00:00Z', 1, 2, 2),
  row('c', '2026-08-02T06:00:00Z', '2026-08-02T08:00:00Z', 0, null, null),
  row('d', '2026-07-02T06:00:00Z', '2026-07-02T07:00:00Z', 2, 4, 5),
  row('live', '2026-10-07T09:00:00Z', null, 4, 12.4, 20),
  row('stuck', '2026-10-05T09:00:00Z', null, 1, null, null),
];

describe('aleMeleView (fish partide.tsx + AleMeleScene)', () => {
  it('c5/c17 — the stat card counts every row, the live partidă included', () => {
    const v = aleMeleView(ROWS, 'live', NOW);
    expect(v.stats).toEqual({ partide: 6, capturi: 11, recordKg: 12.4, totalKg: 41.5 });
  });

  it('c17/c14 — the live partidă is not rendered; another open one is «În desfășurare»', () => {
    const v = aleMeleView(ROWS, 'live', NOW);
    expect(v.open.map(e => e.session.serverId)).toEqual(['stuck']);
    expect(aleMeleView(ROWS, null, NOW).open.map(e => e.session.serverId)).toEqual(['live', 'stuck']);
  });

  it('c15 — the 3 most recent finished partide, newest start first', () => {
    expect(aleMeleView(ROWS, 'live', NOW).preview.map(e => e.session.serverId)).toEqual(['a', 'b', 'c']);
  });

  it('c11–c13 — months, best catch and hours over the rendered list', () => {
    const v = aleMeleView(ROWS, 'live', NOW);
    expect(v.monthly.months.map(m => m.label)).toEqual(['APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT']);
    expect(v.monthly.months.map(m => m.count)).toEqual([0, 0, 0, 2, 0, 1, 4]);
    expect(bestCatchView(v.monthly.bestCatch)).toEqual({ value: '8,2', unit: 'kg', detail: 'Balta a' });
    expect(hoursView(v.monthly)).toEqual({ value: '13', detail: '~3,3 h / partidă' });
  });

  it('c6 — empty only with no partidă and none live; c12/c13 fallbacks', () => {
    const empty = aleMeleView([], null, NOW);
    expect(empty.isEmpty).toBe(true);
    expect(aleMeleView([], 'live', NOW).isEmpty).toBe(false);
    expect(bestCatchView(empty.monthly.bestCatch)).toEqual({ value: '—', unit: null, detail: 'Nicio captură încă' });
    expect(hoursView(empty.monthly)).toEqual({ value: '0', detail: '—' });
    expect(bestCatchView({ weightKg: 3.5, species: 'Crap', venueName: 'Snagov' }).detail).toBe('Crap · Snagov');
  });
});
