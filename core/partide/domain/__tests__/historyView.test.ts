import { describe, it, expect } from 'vitest';
import { computeAggregates, EMPTY_AGGREGATE } from '../historyView';
import type { LocalEvent } from '../types';

const ev = (over: Partial<LocalEvent>): LocalEvent =>
  ({
    clientId: 'e' + Math.random(),
    sessionClientId: 's1',
    outcome: 'capture',
    occurredAt: 0,
    weightKg: null,
    photoUrl: null,
    photoLocalUri: null,
    ...over,
  } as unknown as LocalEvent);

describe('computeAggregates', () => {
  it('counts captures, tracks max weight, keeps latest photo, and lists photos in time order', () => {
    const events: LocalEvent[] = [
      ev({ clientId: 'a', occurredAt: 300, weightKg: 3, photoLocalUri: 'p3' }),
      ev({ clientId: 'b', occurredAt: 100, weightKg: 1, photoLocalUri: 'p1' }),
      ev({ clientId: 'c', occurredAt: 200, weightKg: 5, photoLocalUri: null }),
    ];
    const agg = computeAggregates(events).s1;
    expect(agg.captures).toBe(3);
    expect(agg.recordKg).toBe(5);
    expect(agg.photoUri).toBe('p3'); // latest occurredAt with a photo
    expect(agg.photoUris).toEqual(['p1', 'p3']); // chronological, photo-bearing only
  });

  it('ignores non-capture events and returns nothing for empty input', () => {
    const events = [ev({ outcome: 'lost' as unknown as LocalEvent['outcome'], occurredAt: 1 })];
    expect(computeAggregates(events)).toEqual({});
    expect(EMPTY_AGGREGATE).toEqual({
      captures: 0,
      recordKg: null,
      totalKg: 0,
      photoUri: null,
      photoUris: [],
      photos: [],
    });
  });
});

import {
  applyHistoryView,
  computeHistoryStats,
  distinctVenues,
  sessionVenueName,
} from '../historyView';
import type { LocalSession } from '../types';
import type { Aggregate } from '../historyView';

const JULY = new Date(2026, 6, 8).getTime();
const JUNE = new Date(2026, 5, 20).getTime();

const sess = (over: Partial<LocalSession>): LocalSession =>
  ({
    clientId: 'x',
    lakeName: null,
    publicWaterName: null,
    manualVenueName: null,
    anchorName: null,
    startedAt: JULY,
    endedAt: JULY + 3_600_000,
    rods: [],
    venueType: 'lake',
    standName: null,
    locality: null,
    detailsHydrated: true, // a fully-downloaded row uses its computed aggregate
    ...over,
  } as unknown as LocalSession);

const aggMap = (m: Record<string, Partial<Aggregate>>): Record<string, Aggregate> =>
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [
      k,
      { captures: 0, recordKg: null, totalKg: 0, photoUri: null, photoUris: [], photos: [], ...v },
    ])
  );

describe('sessionVenueName', () => {
  it('falls back through the venue name chain', () => {
    expect(sessionVenueName(sess({ lakeName: 'Vidraru' }))).toBe('Vidraru');
    expect(sessionVenueName(sess({ lakeName: null, publicWaterName: 'Iza' }))).toBe('Iza');
    expect(sessionVenueName(sess({ lakeName: null, manualVenueName: 'Balta X' }))).toBe('Balta X');
    expect(sessionVenueName(sess({ lakeName: null, anchorName: 'Pin' }))).toBe('Pin');
    expect(sessionVenueName(sess({ lakeName: null }))).toBe('Partidă');
  });
});

describe('applyHistoryView', () => {
  const sessions = [
    sess({ clientId: 'a', lakeName: 'Vidraru', startedAt: JULY, endedAt: JULY + 1 }),
    sess({ clientId: 'b', lakeName: 'Iza', startedAt: JULY - 10, endedAt: JULY }),
    sess({ clientId: 'c', lakeName: 'Dunărea', startedAt: JUNE, endedAt: JUNE + 1 }),
    sess({ clientId: 'active', lakeName: 'Live', startedAt: JULY, endedAt: null }), // active — excluded
  ];
  const aggregates = aggMap({
    a: { captures: 2, recordKg: 3 },
    b: { captures: 7, recordKg: 5.5 },
    c: { captures: 0, recordKg: null },
  });

  it('groups ended sessions by month and flags the per-group record', () => {
    const view = applyHistoryView(sessions, aggregates, { sortByWeight: false, venueFilter: [], onlyWithCaptures: false });
    expect(view.mode).toBe('grouped');
    if (view.mode !== 'grouped') return;
    const july = view.groups[0];
    expect(july.entries.map(e => e.session.clientId)).toEqual(['a', 'b']); // newest-first within month
    expect(july.entries.find(e => e.session.clientId === 'b')!.isRecord).toBe(true); // 5.5 > 3
    expect(view.groups.some(g => g.entries.some(e => e.session.clientId === 'active'))).toBe(false);
  });

  it('flat weight-sorted mode with a single global record', () => {
    const view = applyHistoryView(sessions, aggregates, { sortByWeight: true, venueFilter: [], onlyWithCaptures: false });
    expect(view.mode).toBe('flat');
    if (view.mode !== 'flat') return;
    expect(view.entries.map(e => e.session.clientId)).toEqual(['b', 'a', 'c']); // 5.5, 3, null
    expect(view.entries[0].isRecord).toBe(true);
    expect(view.entries.filter(e => e.isRecord)).toHaveLength(1);
  });

  it('applies venue filter and only-with-captures filter', () => {
    const onlyIza = applyHistoryView(sessions, aggregates, { sortByWeight: true, venueFilter: ['Iza'], onlyWithCaptures: false });
    expect(onlyIza.mode === 'flat' && onlyIza.entries.map(e => e.session.clientId)).toEqual(['b']);
    const withCaptures = applyHistoryView(sessions, aggregates, { sortByWeight: true, venueFilter: [], onlyWithCaptures: true });
    expect(withCaptures.mode === 'flat' && withCaptures.entries.map(e => e.session.clientId)).toEqual(['b', 'a']); // c has 0
  });

  it('matches any venue in a multi-key venue filter', () => {
    const izaOrDunarea = applyHistoryView(sessions, aggregates, {
      sortByWeight: true,
      venueFilter: ['Iza', 'Dunărea'],
      onlyWithCaptures: false,
    });
    expect(izaOrDunarea.mode === 'flat' && izaOrDunarea.entries.map(e => e.session.clientId)).toEqual(['b', 'c']);
  });
});

import { aggForSession } from '../historyView';

describe('aggForSession — hydrated vs summary-only source', () => {
  it('returns the computed aggregate for a fully-hydrated session', () => {
    const s = sess({ clientId: 'h', detailsHydrated: true });
    const aggregates = aggMap({ h: { captures: 4, recordKg: 7.2, totalKg: 21.6 } });
    expect(aggForSession(s, aggregates)).toEqual({
      captures: 4,
      recordKg: 7.2,
      totalKg: 21.6,
      photoUri: null,
      photoUris: [],
      photos: [],
    });
  });

  it('falls back to EMPTY_AGGREGATE for a hydrated session with no computed events', () => {
    const s = sess({ clientId: 'h', detailsHydrated: true });
    expect(aggForSession(s, {})).toBe(EMPTY_AGGREGATE);
  });

  it('synthesizes the aggregate from summary fields when details are not downloaded', () => {
    const s = sess({
      clientId: 'sum',
      detailsHydrated: false,
      summaryCaptures: 3,
      summaryRecordKg: 4.1,
      summaryTotalKg: 9.7,
    } as Partial<LocalSession>);
    // Even if a stale computed aggregate lingers in the map, the summary wins.
    const aggregates = aggMap({ sum: { captures: 99, recordKg: 99, totalKg: 99 } });
    expect(aggForSession(s, aggregates)).toEqual({
      captures: 3,
      recordKg: 4.1,
      totalKg: 9.7,
      photoUri: null,
      photoUris: [],
      photos: [],
    });
  });

  it('defaults missing summary fields to 0 captures / null record', () => {
    const s = sess({ clientId: 'sum', detailsHydrated: false } as Partial<LocalSession>);
    expect(aggForSession(s, {})).toEqual({
      captures: 0,
      recordKg: null,
      totalKg: 0,
      photoUri: null,
      photoUris: [],
      photos: [],
    });
  });

  it('lets a not-downloaded session with a summary record win the per-view record flag', () => {
    const downloaded = sess({ clientId: 'dl', lakeName: 'A', detailsHydrated: true, endedAt: JULY + 1 });
    const notDownloaded = sess({
      clientId: 'nd',
      lakeName: 'B',
      detailsHydrated: false,
      summaryCaptures: 1,
      summaryRecordKg: 12.5,
      endedAt: JULY + 2,
    } as Partial<LocalSession>);
    const aggregates = aggMap({ dl: { captures: 2, recordKg: 5 } }); // nd not in map
    const view = applyHistoryView([downloaded, notDownloaded], aggregates, {
      sortByWeight: true,
      venueFilter: [],
      onlyWithCaptures: false,
    });
    expect(view.mode).toBe('flat');
    if (view.mode !== 'flat') return;
    // Sorted heaviest-first: the summary-only 12.5 beats the computed 5.
    expect(view.entries.map(e => e.session.clientId)).toEqual(['nd', 'dl']);
    expect(view.entries[0].isRecord).toBe(true);
    expect(view.entries[0].session.clientId).toBe('nd');
  });
});

const capture = (overrides: Partial<LocalEvent>): LocalEvent =>
  ({
    clientId: 'e1',
    sessionClientId: 's1',
    outcome: 'capture',
    occurredAt: 1,
    weightKg: null,
    photoUrl: null,
    photoLocalUri: null,
    ...overrides,
  }) as LocalEvent;

describe('computeAggregates — photos with weights', () => {
  it('pairs each photo with its capture weight in chronological order', () => {
    const map = computeAggregates([
      capture({ clientId: 'b', occurredAt: 200, weightKg: 3.1, photoUrl: '/b.jpg' }),
      capture({ clientId: 'a', occurredAt: 100, weightKg: 4.6, photoUrl: '/a.jpg' }),
    ]);
    expect(map.s1.photos).toEqual([
      { uri: '/a.jpg', kg: 4.6 },
      { uri: '/b.jpg', kg: 3.1 },
    ]);
  });

  it('keeps photoUris in sync with photos', () => {
    const map = computeAggregates([capture({ weightKg: 1, photoUrl: '/a.jpg' })]);
    expect(map.s1.photoUris).toEqual(['/a.jpg']);
    expect(map.s1.photos.map(p => p.uri)).toEqual(['/a.jpg']);
  });

  it('records a null weight for a photo with no weight', () => {
    const map = computeAggregates([capture({ photoUrl: '/a.jpg' })]);
    expect(map.s1.photos).toEqual([{ uri: '/a.jpg', kg: null }]);
  });

  it('omits captures with no photo', () => {
    const map = computeAggregates([capture({ weightKg: 2 })]);
    expect(map.s1.photos).toEqual([]);
  });
});

describe('computeHistoryStats + distinctVenues', () => {
  const sessions = [
    sess({ clientId: 'a', lakeName: 'Vidraru', endedAt: JULY + 1 }),
    sess({ clientId: 'b', lakeName: 'Iza', endedAt: JULY }),
    sess({ clientId: 'active', lakeName: 'Vidraru', endedAt: null }),
  ];
  const aggregates = aggMap({
    a: { captures: 2, recordKg: 3, totalKg: 5 },
    b: { captures: 7, recordKg: 5.5, totalKg: 30 },
    active: { captures: 1, recordKg: 1, totalKg: 1 },
  });

  it('counts every session (incl. active) and totals captures + record', () => {
    expect(computeHistoryStats(sessions, aggregates)).toEqual({ partide: 3, capturi: 10, recordKg: 5.5, totalKg: 36 });
  });

  it('lists distinct venue names sorted, ended + active alike', () => {
    expect(distinctVenues(sessions)).toEqual(['Iza', 'Vidraru']);
  });
});
