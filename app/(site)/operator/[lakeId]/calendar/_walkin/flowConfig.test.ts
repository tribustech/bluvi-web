import { describe, expect, it } from 'vitest';
import { mergePages, type LakeAvailability } from '@/core/booking';
import { anglerFlow } from '@/app/(site)/balti/[id]/rezerva/_flow/config';
import { guardStep, nextStepFromGrid, selectionTaken } from '@/app/(site)/balti/[id]/rezerva/_flow/guards';
import { flowTargets, isFlowUrl, stepPath } from '@/app/(site)/balti/[id]/rezerva/_flow/nav';
import { stepHref } from '@/app/(site)/balti/[id]/rezerva/_flow/params';
import { buildGridModel, runAction, selectionFree, standRuns } from '@/app/(site)/balti/[id]/rezerva/_grid/model';
import { WALK_IN_CONTINUE_HELD, walkInFlow } from './flowConfig';

process.env.TZ = 'Europe/Bucharest';

/*
 * operator.b.walk-in-shared-flow: the angler's flow modules driven by the walk-in config, and the
 * angler's own config unchanged (booking.rezerva-grila's tests cover its behaviour in full).
 */

const L = 'lake1';
const W = walkInFlow(L);
const SEL = { stand: 's2', start: '2026-10-07T06:00:00+03:00', end: '2026-10-07T18:00:00+03:00' };
// 12:00 on Oct 7: the 06–18 slot is running, its end is 6h away (inside the 24h lead).
const NOW = new Date('2026-10-07T12:00:00+03:00').getTime();

const page: LakeAvailability = {
  lakeId: L,
  bookingEnabled: true,
  incrementHours: 12,
  checkoutBufferMinutes: 0,
  leadHours: 24,
  slotStartTimes: ['06:00', '18:00'],
  timezone: 'Europe/Bucharest',
  stands: [
    { documentId: 's1', name: '1', coordinates: null, extras: ['cab'] },
    { documentId: 's2', name: '2', coordinates: null, extras: [] },
  ],
  extras: [{ key: 'cab', label: 'Cabană', price: 100, unit: 'perNight' }],
  bookings: [{ standDocumentId: 's1', start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00', initials: 'AP' }],
  blocks: [
    { standDocumentId: 's2', start: '2026-10-11T06:00:00+03:00', end: '2026-10-11T18:00:00+03:00', reason: 'other', label: 'Ponton', competitionId: null },
  ],
  window: { from: '2026-10-01T00:00:00+03:00', to: '2026-11-01T00:00:00+02:00' },
};
const merged = mergePages([page]);

describe('walk-in config (operator.calendar)', () => {
  it('lives under /operator/[lakeId]/calendar: grid, extra, confirmare; leaves to the panel (c9, c11)', () => {
    expect(stepHref(L, 'grid', { selection: null, extras: [] }, W)).toBe('/operator/lake1/calendar');
    expect(stepHref(L, 'grid', { selection: SEL, extras: ['x'] }, W)).toBe(
      `/operator/lake1/calendar?stand=s2&start=${encodeURIComponent(SEL.start)}&end=${encodeURIComponent(SEL.end)}`
    );
    expect(stepHref(L, 'extras', { selection: SEL, extras: [] }, W)).toMatch(/^\/operator\/lake1\/calendar\/extra\?stand=s2&/);
    expect(stepHref(L, 'review', { selection: SEL, extras: ['cab'] }, W)).toMatch(/^\/operator\/lake1\/calendar\/confirmare\?.*extra=cab$/);
    expect(stepPath(L, 'extras', W)).toBe('/operator/lake1/calendar/extra');
    expect(stepPath(L, 'review', W)).toBe('/operator/lake1/calendar/confirmare');
    expect(W.paths.exit).toBe('/operator/lake1');
    expect(W.titleFallback).toBe('Balta');
    expect(W.walkIn).toBe(true);
    // The steps are not built yet: Continuă is held with an honest note, never a 404 (c9).
    expect(W.continueHeld).toBe(WALK_IN_CONTINUE_HELD);
  });

  it('flow URLs and history targets follow the config, not /balti/…/rezerva', () => {
    const u = (p: string) => new URL(`https://x${p}`);
    expect(isFlowUrl(u('/operator/lake1/calendar/confirmare'), L, W)).toBe(true);
    expect(isFlowUrl(u('/balti/lake1/rezerva'), L, W)).toBe(false);
    expect(isFlowUrl(u('/operator/lake1'), L, W)).toBe(false);
    const t = flowTargets(L, W);
    expect(t.bareGrid.target(u('/operator/lake1/calendar'))).toBe(true);
    expect(t.bareGrid.target(u('/operator/lake1/calendar?stand=s2'))).toBe(false);
    expect(t.exit.target(u('/operator/lake1'))).toBe(true);
    expect(t.exit.target(u('/operator/lake1/calendar/extra'))).toBe(false);
  });

  it('Continuă: extras only when the stand adds something to this tour (c9)', () => {
    expect(nextStepFromGrid(merged, { stand: 's1', start: '2026-10-08T18:00:00+03:00', end: '2026-10-09T06:00:00+03:00' })).toBe('extras');
    expect(nextStepFromGrid(merged, { stand: 's1', start: '2026-10-08T06:00:00+03:00', end: '2026-10-08T18:00:00+03:00' })).toBe('review');
    expect(nextStepFromGrid(merged, SEL)).toBe('review');
  });

  it('guards redirect inside the walk-in flow', () => {
    expect(guardStep(L, 'extras', { selection: null, extras: [] }, merged, undefined, W)).toBe('/operator/lake1/calendar');
    expect(guardStep(L, 'extras', { selection: SEL, extras: [] }, merged, undefined, W)).toMatch(/^\/operator\/lake1\/calendar\/confirmare\?/);
    // The running slot is still for sale at the gate: the review does not bounce it.
    expect(guardStep(L, 'review', { selection: SEL, extras: [] }, merged, NOW, W)).toBeNull();
    expect(selectionTaken(merged, SEL, NOW, W)).toBe(false);
    // …but it is gone for the angler (started) — the angler's rules are the default.
    expect(selectionTaken(merged, SEL, NOW)).toBe(true);
  });
});

describe('walk-in grid rules (c3 c4 c5 c6)', () => {
  const walk = buildGridModel(merged, NOW, 1, W);
  const angler = buildGridModel(merged, NOW);
  const cell = (m: typeof walk, iso: string) => m.slots.findIndex((s) => s.start === iso);

  it('c3: a running slot is selectable until it ends; an ended one is past', () => {
    const running = cell(walk, '2026-10-07T06:00:00+03:00');
    expect(walk.isAvailable('s2', running)).toBe(true);
    expect(angler.isAvailable('s2', running)).toBe(false);
    expect(walk.isAvailable('s2', cell(walk, '2026-10-06T18:00:00+03:00'))).toBe(false);
    expect(selectionFree(walk, { standDocumentId: 's2', startIndex: running, endIndex: running })).toBe(true);
    const runs = standRuns(walk, { documentId: 's2', name: '2' }, null, null);
    const r = runs.find((x) => x.firstCell === running)!;
    expect(r.isPast).toBe(false);
    expect(runAction(r, { blockOpens: false, bookedOpens: true })).toBe('toggle');
  });

  it('c4: no lead time — nothing is too soon', () => {
    const runs = standRuns(walk, { documentId: 's2', name: '2' }, null, null);
    expect(runs.some((x) => x.tooSoon)).toBe(false);
    expect(walk.isAvailable('s2', cell(walk, '2026-10-07T18:00:00+03:00'))).toBe(true);
    expect(angler.isAvailable('s2', cell(walk, '2026-10-07T18:00:00+03:00'))).toBe(false);
    expect(standRuns(angler, { documentId: 's2', name: '2' }, null, null).some((x) => x.tooSoon)).toBe(true);
  });

  it('c5 c6: a labelled block opens nothing; a booked band opens the booking (even a past one)', () => {
    const blocked = standRuns(walk, { documentId: 's2', name: '2' }, null, null).find((x) => x.status === 'blocked')!;
    expect(runAction(blocked, { blockOpens: false, bookedOpens: true })).toBe('none');
    expect(runAction(blocked)).toBe('block');
    const booked = standRuns(walk, { documentId: 's1', name: '1' }, null, null).find((x) => x.status === 'booked')!;
    expect(runAction(booked, { blockOpens: false, bookedOpens: true })).toBe('booked');
    expect(runAction({ ...booked, isPast: true }, { blockOpens: false, bookedOpens: true })).toBe('booked');
    expect(runAction(booked)).toBe('none');
  });

  it('the angler config is the default everywhere', () => {
    const a = anglerFlow(L);
    expect(a.paths.grid).toBe('/balti/lake1/rezerva');
    expect(stepHref(L, 'review', { selection: SEL, extras: [] })).toBe(stepHref(L, 'review', { selection: SEL, extras: [] }, a));
    expect(a.enforceLeadTime && !a.allowInProgress && a.blockedCellOpens && !a.walkIn).toBe(true);
    expect(a.continueHeld).toBeNull();
  });
});
