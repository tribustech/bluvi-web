import { describe, expect, it } from 'vitest';
import { countdownCells, countdownParts, showCountdown } from './Countdown';

const end = new Date('2026-12-31T21:00:00.000Z');

describe('countdownParts (participant.raffle-status.c3)', () => {
  it('splits the time left into whole days, hours and minutes (floored)', () => {
    const now = Date.parse('2026-12-29T18:29:30.000Z');
    expect(countdownParts(end, now)).toEqual({ days: 2, hours: 2, minutes: 30 });
  });

  it('under a minute left reads 0 / 0 / 0', () => {
    expect(countdownParts(end, end.getTime() - 59_000)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('a past end never goes negative', () => {
    expect(countdownParts(end, end.getTime() + 5 * 60_000)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('no end date (or an invalid one) reads 0 / 0 / 0', () => {
    expect(countdownParts(null, 0)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(countdownParts(new Date('nope'), 0)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('exact boundaries', () => {
    expect(countdownParts(end, end.getTime() - 24 * 3_600_000)).toEqual({ days: 1, hours: 0, minutes: 0 });
    expect(countdownParts(end, end.getTime() - 3_600_000 - 60_000)).toEqual({ days: 0, hours: 1, minutes: 1 });
  });
});

describe('showCountdown', () => {
  it('only before the end and with an end date', () => {
    expect(showCountdown({ isEnded: false, countdownEnd: end })).toBe(true);
    expect(showCountdown({ isEnded: true, countdownEnd: end })).toBe(false);
    expect(showCountdown({ isEnded: false, countdownEnd: null })).toBe(false);
  });
});

describe('countdownCells (owner rule: correct plurals)', () => {
  const labels = (p: { days: number; hours: number; minutes: number }) => countdownCells(p).map((c) => c.label);
  const spoken = (p: { days: number; hours: number; minutes: number }) => countdownCells(p).map((c) => c.spoken);

  it('1 takes the singular: Zi / Oră / Minut', () => {
    expect(labels({ days: 1, hours: 1, minutes: 1 })).toEqual(['Zi', 'Oră', 'Minut']);
    expect(spoken({ days: 1, hours: 1, minutes: 1 })).toEqual(['1 zi', '1 oră', '1 minut']);
  });

  it('0 and 2–19 the plural', () => {
    expect(labels({ days: 0, hours: 2, minutes: 19 })).toEqual(['Zile', 'Ore', 'Minute']);
    expect(spoken({ days: 0, hours: 2, minutes: 19 })).toEqual(['0 zile', '2 ore', '19 minute']);
  });

  it('from 20 the label stays the plural; read with its number it takes «de»', () => {
    expect(labels({ days: 20, hours: 23, minutes: 20 })).toEqual(['Zile', 'Ore', 'Minute']);
    expect(spoken({ days: 20, hours: 23, minutes: 20 })).toEqual(['20 de zile', '23 de ore', '20 de minute']);
    expect(spoken({ days: 101, hours: 0, minutes: 59 })).toEqual(['101 zile', '0 ore', '59 de minute']);
  });

  it('keeps the order days, hours, minutes with the ids the page tests by', () => {
    expect(countdownCells({ days: 3, hours: 4, minutes: 5 }).map((c) => [c.id, c.value])).toEqual([
      ['days', 3],
      ['hours', 4],
      ['minutes', 5],
    ]);
  });
});
