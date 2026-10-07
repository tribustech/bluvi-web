import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/routes';
import { filtersFromParams, historySections, NO_FILTERS, toSessions, venueChipLabel, venueOptions, windowSections } from './view';
import type { SessionListItemDTO } from '@/core/partide';

const row = (id: string, start: string, o: Partial<SessionListItemDTO> = {}): SessionListItemDTO =>
  ({
    documentId: id,
    clientId: `c-${id}`,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: null,
    lakeName: 'Balta Chita',
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
    startedAt: start,
    endedAt: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
    plannedDurationMs: null,
    notes: null,
    visibleOnProfile: true,
    status: 'finished',
    targetSpecies: [],
    hostUid: null,
    captures: 1,
    recordKg: 2,
    totalKg: 2,
    ...o,
  }) as SessionListItemDTO;

const ROWS = [
  row('a', '2026-09-20T05:00:00Z', { recordKg: 3, locality: 'Ilfov' }),
  row('b', '2026-08-02T05:00:00Z', { lakeName: 'Ălești', captures: 0, recordKg: null }),
  row('c', '2026-09-01T05:00:00Z', { lakeName: 'Lacul Snagov', recordKg: 9 }),
  row('d', '2026-08-10T05:00:00Z', { lakeName: 'Lacul Snagov', recordKg: 1 }),
  row('open', '2026-09-28T05:00:00Z', { endedAt: null, status: 'active', lakeName: 'Deschisă' }),
];
const sessions = toSessions(ROWS);
const ids = (s: ReturnType<typeof historySections>) => s.flatMap(x => x.entries.map(e => e.session.serverId));

describe('partide.istoric view', () => {
  it('c2 — finished only, by month newest first, newest first inside', () => {
    const s = historySections(sessions, NO_FILTERS);
    expect(s.map(x => x.title)).toEqual(['SEPTEMBRIE 2026', 'AUGUST 2026']);
    expect(ids(s)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('c3 — «Greutate»: one untitled section by record kg descending', () => {
    const s = historySections(sessions, { ...NO_FILTERS, byWeight: true });
    expect(s).toHaveLength(1);
    expect(s[0].title).toBeNull();
    expect(ids(s)).toEqual(['c', 'a', 'd', 'b']);
  });
  it('c4 c5 — venue names and «Cu capturi»; empty months dropped', () => {
    expect(ids(historySections(sessions, { ...NO_FILTERS, venues: ['Lacul Snagov'] }))).toEqual(['c', 'd']);
    expect(ids(historySections(sessions, { ...NO_FILTERS, withCaptures: true }))).toEqual(['a', 'c', 'd']);
    expect(historySections(sessions, { ...NO_FILTERS, venues: ['Ălești'], withCaptures: true })).toEqual([]);
  });
  it('c4 — venue options: finished venues, ro collation, locality else «n partidă/partide»', () => {
    expect(venueOptions(sessions).map(o => [o.name, o.helper])).toEqual([
      ['Ălești', '1 partidă'],
      ['Balta Chita', 'Ilfov'],
      ['Lacul Snagov', '2 partide'],
    ]);
    expect(venueChipLabel([])).toBeNull();
    expect(venueChipLabel(['Balta Chita'])).toBe('Balta Chita');
    expect(venueChipLabel(['a', 'b'])).toBe('2 bălți');
  });
  it('c6 — the window cuts across months and never leaves a lone label', () => {
    const s = historySections(sessions, NO_FILTERS);
    const w = windowSections(s, 2);
    expect(w.map(x => x.title)).toEqual(['SEPTEMBRIE 2026']);
    expect(ids(windowSections(s, 3))).toEqual(['a', 'c', 'd']);
  });
  it('c8 — URL round trip', () => {
    const f = { byWeight: true, venues: ['Balta Chita', 'Lacul Snagov'], withCaptures: true };
    const href = routes.partideHistory(f);
    expect(href).toBe('/partide/istoric?sortare=greutate&balti=Balta+Chita&balti=Lacul+Snagov&cu-capturi=1');
    const sp = new URLSearchParams(href.split('?')[1]);
    expect(filtersFromParams({ sortare: sp.get('sortare')!, balti: sp.getAll('balti'), 'cu-capturi': sp.get('cu-capturi')! })).toEqual(f);
    expect(filtersFromParams({})).toEqual(NO_FILTERS);
  });
});
