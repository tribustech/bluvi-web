import { describe, expect, it } from 'vitest';
import type { LakeAvailability } from '@/core/booking';
import { mergePages } from '@/core/booking';
import { guardStep, nextStepFromGrid, offeredForSelection, previousStep, seedSelection, selectionTaken } from './guards';
import { flowTargets, historyDelta, isFlowUrl, stepPath } from './nav';
import { flowQuery, readFlowParams, sameSelection, stepHref } from './params';

process.env.TZ = 'Europe/Bucharest';

const SEL = {
  stand: 's2',
  start: '2026-10-10T18:00:00+03:00',
  end: '2026-10-11T06:00:00+03:00',
};

describe('flow params codec (booking.b.flow-state, c24)', () => {
  it('round-trips a selection, extras sorted and de-duplicated', () => {
    const q = flowQuery(SEL, ['b', 'a', 'a']);
    expect(q).toBe('stand=s2&start=2026-10-10T18%3A00%3A00%2B03%3A00&end=2026-10-11T06%3A00%3A00%2B03%3A00&extra=a&extra=a&extra=b');
    expect(readFlowParams(new URLSearchParams(q))).toEqual({
      selection: SEL,
      extras: ['a', 'b'],
    });
  });

  it('reads Next searchParams records too', () => {
    expect(
      readFlowParams({
        stand: 's2',
        start: SEL.start,
        end: SEL.end,
        extra: ['x'],
      })
    ).toEqual({ selection: SEL, extras: ['x'] });
  });

  it('a half or malformed selection is no selection (never a guess)', () => {
    expect(readFlowParams(new URLSearchParams('stand=s2')).selection).toBeNull();
    expect(readFlowParams({ stand: 's2', start: SEL.end, end: SEL.start }).selection).toBeNull();
    expect(readFlowParams({ stand: 's2', start: '2026-10-10', end: SEL.end }).selection).toBeNull();
    expect(readFlowParams({ stand: '', start: SEL.start, end: SEL.end }).selection).toBeNull();
    expect(readFlowParams({ extra: 'x' })).toEqual({
      selection: null,
      extras: [],
    });
    expect(
      readFlowParams({
        ...{ stand: 's2', start: SEL.start, end: SEL.end },
        extra: '<b>',
      }).extras
    ).toEqual([]);
  });

  it('step hrefs: the grid never carries extras; the later steps do', () => {
    const p = { selection: SEL, extras: ['cabana'] };
    expect(stepHref('lake 1', 'grid', p)).toBe(`/balti/lake%201/rezerva?${flowQuery(SEL)}`);
    expect(stepHref('l', 'extras', p)).toBe(`/balti/l/rezerva/extra?${flowQuery(SEL, ['cabana'])}`);
    expect(stepHref('l', 'review', p)).toBe(`/balti/l/rezerva/confirmare?${flowQuery(SEL, ['cabana'])}`);
    expect(stepHref('l', 'review', { selection: null, extras: [] })).toBe('/balti/l/rezerva');
  });

  it('compares instants, not spellings', () => {
    expect(sameSelection(SEL, { ...SEL, start: '2026-10-10T15:00:00Z' })).toBe(true);
    expect(sameSelection(SEL, null)).toBe(false);
  });
});

const page = (over: Partial<LakeAvailability> = {}): LakeAvailability => ({
  lakeId: 'l',
  bookingEnabled: true,
  incrementHours: 12,
  checkoutBufferMinutes: 30,
  leadHours: 24,
  slotStartTimes: ['06:00', '18:00'],
  timezone: 'Europe/Bucharest',
  stands: [
    { documentId: 's1', name: '1', coordinates: null, extras: [] },
    { documentId: 's2', name: '2', coordinates: null, extras: ['cabana'] },
  ],
  extras: [{ key: 'cabana', label: 'Cabană', price: 150, unit: 'perNight' }],
  bookings: [],
  blocks: [],
  window: {
    from: '2026-10-01T00:00:00+03:00',
    to: '2026-11-01T00:00:00+02:00',
  },
  ...over,
});

describe('selection guards (c34, c35, booking.rezerva-extra.c1/c2)', () => {
  const merged = mergePages([page()]);
  const day = {
    stand: 's2',
    start: '2026-10-10T06:00:00+03:00',
    end: '2026-10-10T18:00:00+03:00',
  };

  it('a per-night extra is offered only for a tour that crosses a lake-local midnight', () => {
    expect(offeredForSelection(merged, SEL).map(e => e.key)).toEqual(['cabana']);
    expect(offeredForSelection(merged, day)).toEqual([]);
    expect(offeredForSelection(merged, { ...SEL, stand: 's1' })).toEqual([]);
  });

  it('Continuă goes to the extras step only when the stand adds something to this tour', () => {
    expect(nextStepFromGrid(merged, SEL)).toBe('extras');
    expect(nextStepFromGrid(merged, day)).toBe('review');
  });

  it('later steps without a selection, or with a stand the lake no longer has, go back to the grid', () => {
    expect(guardStep('l', 'review', { selection: null, extras: [] }, merged)).toBe('/balti/l/rezerva');
    expect(guardStep('l', 'review', { selection: { ...SEL, stand: 'gone' }, extras: [] }, merged)).toBe('/balti/l/rezerva');
    expect(guardStep('l', 'review', { selection: SEL, extras: [] }, null)).toBeNull();
    expect(guardStep('l', 'extras', { selection: SEL, extras: [] }, merged)).toBeNull();
    expect(guardStep('l', 'extras', { selection: day, extras: [] }, merged)).toBe(stepHref('l', 'review', { selection: day, extras: [] }));
    expect(guardStep('l', 'review', { selection: SEL, extras: [] }, mergePages([page({ bookingEnabled: false })]))).toBe('/balti/l/rezerva');
  });

  it('the review re-judges the tour against the live availability (the grid selectionFree): taken, started, lead time → the grid', () => {
    const now = Date.parse('2026-10-05T12:00:00+03:00');
    expect(selectionTaken(merged, SEL, now)).toBe(false);
    expect(guardStep('l', 'review', { selection: SEL, extras: [] }, merged, now)).toBeNull();
    // Booked (the angler's own booking reached again by Forward counts too).
    const booked = mergePages([
      page({
        bookings: [{ standDocumentId: 's2', start: SEL.start, end: SEL.end }] as LakeAvailability['bookings'],
      }),
    ]);
    expect(selectionTaken(booked, SEL, now)).toBe(true);
    expect(guardStep('l', 'review', { selection: SEL, extras: [] }, booked, now)).toBe('/balti/l/rezerva');
    // Another stand's booking does not count; without `nowMs` (the extras step) nothing is judged.
    expect(selectionTaken(booked, { ...SEL, stand: 's1' }, now)).toBe(false);
    expect(guardStep('l', 'review', { selection: SEL, extras: [] }, booked)).toBeNull();
    // Inside the 24h lead time, or started.
    expect(selectionTaken(merged, SEL, Date.parse('2026-10-10T08:00:00+03:00'))).toBe(true);
    // Past the loaded months: cannot be judged yet.
    expect(
      selectionTaken(
        merged,
        {
          stand: 's2',
          start: '2026-11-10T06:00:00+02:00',
          end: '2026-11-10T18:00:00+02:00',
        },
        now
      )
    ).toBeNull();
  });

  it('seeds by instant onto the loaded slots', () => {
    const slots = [
      { start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00' },
      { start: '2026-10-10T18:00:00+03:00', end: '2026-10-11T06:00:00+03:00' },
    ];
    expect(
      seedSelection(
        {
          stand: 's1',
          start: '2026-10-10T03:00:00Z',
          end: '2026-10-11T03:00:00Z',
        },
        slots
      )
    ).toEqual({
      standDocumentId: 's1',
      startIndex: 0,
      endIndex: 1,
    });
    expect(
      seedSelection(
        {
          stand: 's1',
          start: '2026-10-12T03:00:00Z',
          end: '2026-10-13T03:00:00Z',
        },
        slots
      )
    ).toBeNull();
  });
});

describe('leaving a step (nav.ts: fish goBack / backToGrid / exitFlow)', () => {
  const O = 'https://bluvi.test';
  const q = flowQuery(SEL);
  const entries = (...paths: string[]) => paths.map(p => ({ url: `${O}${p}` }));
  const run = (h: { url: string | null }[], t: { target: (u: URL) => boolean; through: (u: URL) => boolean }) =>
    historyDelta(h, h.length - 1, O, t.target, t.through);
  const T = flowTargets('l');

  it('step paths', () => {
    expect(stepPath('l', 'grid')).toBe('/balti/l/rezerva');
    expect(stepPath('l', 'extras')).toBe('/balti/l/rezerva/extra');
    expect(stepPath('l', 'review')).toBe('/balti/l/rezerva/confirmare');
  });

  it('stepBack pops to the previous step, through the flow only', () => {
    const h = entries(
      '/balti/l',
      '/balti/l/rezerva',
      `/balti/l/rezerva?${q}`,
      `/balti/l/rezerva/extra?${q}`,
      `/balti/l/rezerva/confirmare?${q}`
    );
    expect(run(h, T.step('extras'))).toBe(-1);
    expect(run(h, T.step('grid'))).toBe(-2);
    // A review opened from a shared link: no flow entry before it.
    expect(run(entries('/balti/l', `/balti/l/rezerva/confirmare?${q}`), T.step('grid'))).toBeNull();
    // Another lake's flow does not count.
    expect(run(entries('/balti/x/rezerva', `/balti/l/rezerva/confirmare?${q}`), T.step('grid'))).toBeNull();
  });

  it('backToGrid finds the bare grid under the selection entry', () => {
    const h = entries('/balti/l', '/balti/l/rezerva', `/balti/l/rezerva?${q}`, `/balti/l/rezerva/confirmare?${q}`);
    expect(run(h, T.bareGrid)).toBe(-2);
    expect(run(entries('/balti/l', `/balti/l/rezerva?${q}`, `/balti/l/rezerva/confirmare?${q}`), T.bareGrid)).toBeNull();
  });

  it('exitFlow lands where the flow was entered, past /intra', () => {
    const h = entries('/rezervari/b1', '/balti/l/rezerva', `/balti/l/rezerva?${q}`, `/balti/l/rezerva/confirmare?${q}`);
    expect(run(h, T.exit)).toBe(-3);
    expect(run(entries('/balti/l', '/intra?next=x', '/balti/l/rezerva', `/balti/l/rezerva/confirmare?${q}`), T.exit)).toBe(-3);
    expect(run(entries(`/balti/l/rezerva/confirmare?${q}`), T.exit)).toBeNull();
    expect(historyDelta([{ url: 'https://other.test/a' }, { url: `${O}/balti/l/rezerva` }], 1, O, T.exit.target, T.exit.through)).toBeNull();
    expect(historyDelta([{ url: null }, { url: `${O}/balti/l/rezerva` }], 1, O, T.exit.target, T.exit.through)).toBeNull();
    expect(isFlowUrl(new URL(`${O}/balti/l/rezervari`), 'l')).toBe(false);
  });

  it('previousStep: the extras step only when the stand adds something to this tour', () => {
    const merged = mergePages([page()]);
    expect(previousStep(merged, SEL)).toBe('extras');
    expect(previousStep(merged, { ...SEL, stand: 's1' })).toBe('grid');
    expect(previousStep(null, SEL)).toBe('grid');
  });
});
