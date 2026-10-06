import { describe, expect, it } from 'vitest';
import type { CommunityActiveSessionDTO, CommunityMemberDTO } from '../../schemas';
import { hasPartideActivity, isWeighed, liveHeadStats, liveRowLabel, rowMeta } from '../liveCompare';

// Ported from fish features/partide/components/community/__tests__/liveCompare.test.ts and
// features/lakes/helpers/__tests__/lakeDetailLogic.test.ts (hasPartideActivity).

const session = (over: Partial<CommunityActiveSessionDTO> & { documentId: string }): CommunityActiveSessionDTO => ({
  startedAt: '2026-08-04T06:00:00.000Z',
  members: [],
  catchCount: 0,
  maxKg: null,
  totalKg: null,
  ...over,
});

describe('isWeighed', () => {
  it('only counts numbers above zero', () => {
    expect(isWeighed(3.2)).toBe(true);
    expect(isWeighed(0)).toBe(false);
    expect(isWeighed(null)).toBe(false);
    expect(isWeighed(undefined)).toBe(false);
  });
});

describe('liveHeadStats', () => {
  it('sums catches and weighed kg', () => {
    expect(
      liveHeadStats([session({ documentId: 'a', catchCount: 5, totalKg: 20.6 }), session({ documentId: 'b', catchCount: 3, totalKg: 12 })]),
    ).toEqual({ catches: 8, totalKg: 32.6, maxKg: null });
  });

  it('reports null kg when nothing has been weighed', () => {
    expect(liveHeadStats([session({ documentId: 'a' }), session({ documentId: 'b' })])).toEqual({ catches: 0, totalKg: null, maxKg: null });
  });

  it('skips null totals instead of treating them as zero', () => {
    expect(
      liveHeadStats([session({ documentId: 'a', catchCount: 2, totalKg: 7.5 }), session({ documentId: 'b', catchCount: 1, totalKg: null })]),
    ).toEqual({ catches: 3, totalKg: 7.5, maxKg: null });
  });

  it('treats a missing catchCount as zero', () => {
    expect(liveHeadStats([session({ documentId: 'a', catchCount: null, totalKg: 3 })])).toEqual({ catches: 0, totalKg: 3, maxKg: null });
  });

  it('reports the biggest single catch across the live sessions', () => {
    expect(
      liveHeadStats([
        session({ documentId: 'a', catchCount: 3, totalKg: 15.2, maxKg: 6.4 }),
        session({ documentId: 'b', catchCount: 3, totalKg: 11, maxKg: 5 }),
      ]).maxKg,
    ).toBe(6.4);
    expect(liveHeadStats([]).maxKg).toBeNull();
  });
});

describe('rowMeta', () => {
  const base = { standName: '2', catchCount: 3, totalKg: 15.2, maxKg: 6.4, elapsed: 'de 9h 22m' };

  it('reads stand, catches and biggest fish', () => {
    expect(rowMeta(base)).toEqual({ stand: 'Stand 2', rest: '3 capturi · max 6,4 kg' });
  });

  it('drops the max when nothing was weighed, or the aggregate sums to exactly 0', () => {
    expect(rowMeta({ ...base, catchCount: 2, totalKg: null, maxKg: null })).toEqual({ stand: 'Stand 2', rest: '2 capturi' });
    expect(rowMeta({ ...base, catchCount: 2, totalKg: 0, maxKg: 0 })).toEqual({ stand: 'Stand 2', rest: '2 capturi' });
    expect(rowMeta({ ...base, catchCount: 2, totalKg: null, maxKg: 4.2 })).toEqual({ stand: 'Stand 2', rest: '2 capturi' });
  });

  it('replaces the catch parts with time on the water when there are no catches', () => {
    expect(rowMeta({ ...base, standName: '15', catchCount: 0, totalKg: null, maxKg: null, elapsed: 'de 14h 17m' })).toEqual({
      stand: 'Stand 15',
      rest: 'de 14h 17m la apă',
    });
    expect(rowMeta({ ...base, catchCount: null, totalKg: null, maxKg: null })).toEqual({ stand: 'Stand 2', rest: 'de 9h 22m la apă' });
  });

  it('omits the stand on a venue that has none; singular for one catch', () => {
    expect(rowMeta({ ...base, standName: null })).toEqual({ stand: null, rest: '3 capturi · max 6,4 kg' });
    expect(rowMeta({ ...base, catchCount: 1 })).toEqual({ stand: 'Stand 2', rest: '1 captură · max 6,4 kg' });
  });
});

describe('liveRowLabel', () => {
  const m = (name: string | null, uid = name ?? 'x'): CommunityMemberDTO => ({ uid, name, avatarUrl: null }) as CommunityMemberDTO;

  it('keeps a solo angler’s full name and reduces a team to first names', () => {
    expect(liveRowLabel([m('Mario G')])).toBe('Mario G');
    expect(liveRowLabel([m('Mario G'), m('Iulian Deaconu')])).toBe('Mario și Iulian');
    expect(liveRowLabel([m('Mario G'), m('Iulian Deaconu'), m('Gilberto Holt')])).toBe('Mario, Iulian și Gilberto');
  });

  it('falls back to the member count when a name is missing', () => {
    expect(liveRowLabel([m('Mario G'), m(null, 'u2'), m('Gilberto Holt')])).toBe('3 pescari');
  });
});

describe('hasPartideActivity', () => {
  const base = { stats: { activeNow: 0, catchesThisMonth: 0, recordKg: null }, monthlyActivity: [] as { month: string; count: number }[] };

  it('is false for null and for an all-zero venue', () => {
    expect(hasPartideActivity(null)).toBe(false);
    expect(hasPartideActivity({ ...base, monthlyActivity: [{ month: 'IUL', count: 0 }] })).toBe(false);
  });

  it('is true when anything is non-zero', () => {
    expect(hasPartideActivity({ ...base, stats: { ...base.stats, activeNow: 1 } })).toBe(true);
    expect(hasPartideActivity({ ...base, stats: { ...base.stats, catchesThisMonth: 2 } })).toBe(true);
    expect(hasPartideActivity({ ...base, stats: { ...base.stats, recordKg: 3.2 } })).toBe(true);
    expect(hasPartideActivity({ ...base, monthlyActivity: [{ month: 'IUL', count: 2 }] })).toBe(true);
  });
});
