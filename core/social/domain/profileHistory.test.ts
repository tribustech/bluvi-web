import { describe, expect, it } from 'vitest';
import type { PublicSession } from '../schemas';
import {
  bioParts,
  dedupeByKey,
  fmtCatchDate,
  fmtCompetitionRange,
  fmtProfileKg,
  fmtSessionRange,
  groupPublicSessionsByMonth,
  trophyTiers,
} from './profileHistory';

const session = (documentId: string, startedAt: string): PublicSession => ({
  documentId,
  venueName: null,
  photoUrl: null,
  startedAt,
  durationMs: 0,
  isActive: false,
  catches: 0,
  totalKg: null,
  maxKg: null,
  isPersonalRecord: false,
});

// ── fish helpers/groupSessionsByMonth.ts ──────────────────────────────────────────────────────────
describe('groupPublicSessionsByMonth', () => {
  it('puts a «{LUNA} {an}» header before each month, keeping the server order', () => {
    const rows = groupPublicSessionsByMonth([
      session('a', '2026-07-20T08:00:00.000Z'),
      session('b', '2026-07-02T08:00:00.000Z'),
      session('c', '2026-06-30T08:00:00.000Z'),
      session('d', '2025-12-31T08:00:00.000Z'),
    ]);
    expect(rows.map(r => (r.type === 'header' ? r.label : r.session.documentId))).toEqual([
      'IULIE 2026',
      'a',
      'b',
      'IUNIE 2026',
      'c',
      'DECEMBRIE 2025',
      'd',
    ]);
    expect(rows[1]).toMatchObject({ type: 'session', key: 'a' });
  });

  it('reads the month in Romania time (23:30 UTC on 31 July is August there)', () => {
    const rows = groupPublicSessionsByMonth([session('a', '2026-07-31T23:30:00.000Z')]);
    expect(rows[0]).toEqual({ type: 'header', key: 'h-AUGUST 2026', label: 'AUGUST 2026' });
  });

  it('does not reorder: a month seen again later gets its header again', () => {
    const rows = groupPublicSessionsByMonth([session('a', '2026-07-20T08:00:00Z'), session('b', '2026-06-20T08:00:00Z'), session('c', '2026-07-01T08:00:00Z')]);
    expect(rows.filter(r => r.type === 'header').map(r => (r as { label: string }).label)).toEqual(['IULIE 2026', 'IUNIE 2026', 'IULIE 2026']);
  });

  it('is empty for no sessions', () => {
    expect(groupPublicSessionsByMonth([])).toEqual([]);
  });
});

// ── fish helpers/fmtCompetitionRange.ts (its doc comment's examples) ─────────────────────────────
describe('fmtCompetitionRange', () => {
  it('formats one day, one month, two months and two years', () => {
    expect(fmtCompetitionRange('2025-10-02T07:00:00Z', '2025-10-02T15:00:00Z')).toBe('2 OCT 2025');
    expect(fmtCompetitionRange('2025-10-02T07:00:00Z', null)).toBe('2 OCT 2025');
    expect(fmtCompetitionRange('2025-09-05T07:00:00Z', '2025-09-07T15:00:00Z')).toBe('5–7 SEP 2025');
    expect(fmtCompetitionRange('2025-09-30T07:00:00Z', '2025-10-02T15:00:00Z')).toBe('30 SEP – 2 OCT 2025');
    expect(fmtCompetitionRange('2025-12-30T07:00:00Z', '2026-01-02T15:00:00Z')).toBe('30 DEC 2025 – 2 IAN 2026');
  });
  it('is empty without a start', () => {
    expect(fmtCompetitionRange(null, '2025-10-02T07:00:00Z')).toBe('');
  });
});

// ── fish helpers/dedupeByKey.ts ───────────────────────────────────────────────────────────────────
describe('dedupeByKey', () => {
  it('keeps the first occurrence and the order', () => {
    const items = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'a', v: 3 },
      { id: 'c', v: 4 },
      { id: 'b', v: 5 },
    ];
    expect(dedupeByKey(items, i => i.id)).toEqual([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'c', v: 4 },
    ]);
  });
  it('is a no-op without duplicates', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(dedupeByKey(items, i => i.id)).toEqual(items);
  });
});

describe('profile formatters', () => {
  it('fmtProfileKg: one decimal with a comma (fish StatStrip)', () => {
    expect(fmtProfileKg(12.44)).toBe('12,4');
    expect(fmtProfileKg(5)).toBe('5,0');
  });
  it('fmtCatchDate: «d MMM yyyy» in Romania time (fish CatchDetailFooter)', () => {
    expect(fmtCatchDate('2025-09-05T10:00:00Z')).toBe('5 SEP 2025');
    expect(fmtCatchDate('2025-12-31T22:30:00Z')).toBe('1 IAN 2026');
  });
  it('bioParts: #hashtags with letters, digits and underscore (fish BioText)', () => {
    expect(bioParts('Crap #carp_fishing și #știucă2 la #')).toEqual([
      { text: 'Crap ', tag: false },
      { text: '#carp_fishing', tag: true },
      { text: ' și ', tag: false },
      { text: '#știucă2', tag: true },
      { text: ' la #', tag: false },
    ]);
  });
  it('trophyTiers: only the tiers above zero (fish TrophyRow)', () => {
    expect(trophyTiers({ first: 0, second: 0, third: 0 })).toEqual([]);
    expect(trophyTiers({ first: 2, second: 0, third: 1 })).toEqual([
      { key: 'first', count: 2 },
      { key: 'third', count: 1 },
    ]);
  });
});

describe('fmtSessionRange', () => {
  it('same Romania day: «26 IUL · 06:40 – 18:10»', () => {
    expect(fmtSessionRange('2026-07-26T03:40:00.000Z', '2026-07-26T15:10:00.000Z')).toBe('26 IUL · 06:40 – 18:10');
  });
  it('past midnight in Romania names the end day too (never «14:32 – 12:54» under one date)', () => {
    expect(fmtSessionRange('2026-02-17T12:32:00.000Z', '2026-02-18T10:54:00.000Z')).toBe('17 FEB 14:32 – 18 FEB 12:54');
    expect(fmtSessionRange('2026-02-14T19:24:00.000Z', '2026-02-14T22:34:00.000Z')).toBe('14 FEB 21:24 – 15 FEB 00:34');
  });
  it('a multi-day session across a month end', () => {
    expect(fmtSessionRange('2026-01-30T06:00:00.000Z', '2026-02-01T04:00:00.000Z')).toBe('30 IAN 08:00 – 1 FEB 06:00');
  });
  it('the day is Romania’s, not UTC’s: 23:30 UTC on the 14th is already the 15th', () => {
    expect(fmtSessionRange('2026-02-14T23:30:00.000Z', '2026-02-15T03:00:00.000Z')).toBe('15 FEB · 01:30 – 05:00');
  });
  it('unparseable start → empty', () => {
    expect(fmtSessionRange('nope', '2026-02-15T03:00:00.000Z')).toBe('');
  });
});
