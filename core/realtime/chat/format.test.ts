import { describe, expect, it } from 'vitest';
import { formatCount, formatDayLabel, formatTime24, getDayKey } from './format';

describe('formatTime24', () => {
  it('pads hours and minutes, 24h', () => {
    expect(formatTime24(new Date(2026, 8, 8, 16, 39))).toBe('16:39');
    expect(formatTime24(new Date(2026, 8, 8, 9, 5))).toBe('09:05');
    expect(formatTime24(new Date(2026, 8, 8, 0, 0))).toBe('00:00');
  });
  it('is empty for a missing date', () => {
    expect(formatTime24(undefined)).toBe('');
  });
});

describe('formatDayLabel', () => {
  const now = new Date(2026, 8, 8, 12, 0); // Tuesday 8 Sep 2026
  it('today / yesterday', () => {
    expect(formatDayLabel(new Date(2026, 8, 8, 1, 0), now)).toBe('Astăzi');
    expect(formatDayLabel(new Date(2026, 8, 7, 23, 59), now)).toBe('Ieri');
  });
  it('same year: weekday + day + short month', () => {
    expect(formatDayLabel(new Date(2026, 8, 6), now)).toBe('duminică, 6 sept.');
    expect(formatDayLabel(new Date(2026, 0, 15), now)).toBe('joi, 15 ian.');
  });
  it('other year: day + short month + year, no weekday', () => {
    expect(formatDayLabel(new Date(2025, 11, 31), now)).toBe('31 dec. 2025');
  });
  it('missing date reads as today (pending messages)', () => {
    expect(formatDayLabel(undefined, now)).toBe('Astăzi');
  });
});

describe('getDayKey', () => {
  it('is local-date based', () => {
    expect(getDayKey(new Date(2026, 8, 8, 23, 59))).toBe('2026-8-8');
  });
});

describe('formatCount (Romanian)', () => {
  it('singular / plural / "de" from 20', () => {
    expect(formatCount(1, 'urmăritor', 'urmăritori')).toBe('1 urmăritor');
    expect(formatCount(3, 'urmăritor', 'urmăritori')).toBe('3 urmăritori');
    expect(formatCount(19, 'participant', 'participanți')).toBe('19 participanți');
    expect(formatCount(20, 'participant', 'participanți')).toBe('20 de participanți');
    expect(formatCount(101, 'participant', 'participanți')).toBe('101 participanți');
    expect(formatCount(120, 'participant', 'participanți')).toBe('120 de participanți');
    expect(formatCount(0, 'urmăritor', 'urmăritori')).toBe('0 urmăritori');
  });
});
