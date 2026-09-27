import { describe, expect, it } from 'vitest';
import { trendAxisLabels, trendDetailLabel, trendSummary, todayIndex } from './trendLabels';
import type { OperatorTrendPoint } from './trendLabels';

const pt = (date: string): OperatorTrendPoint => ({ date, booked: 0, total: 5, cash: 0, bookings: 0 });

// Monday 2026-08-17 .. Sunday 2026-08-23.
const WEEK = ['17', '18', '19', '20', '21', '22', '23'].map(d => pt(`2026-08-${d}`));

describe('trendAxisLabels', () => {
  it('names the days of a week, Monday first', () => {
    expect(trendAxisLabels(WEEK, 'week')).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  it('labels only every fifth day of a month, plus the last', () => {
    const month = Array.from({ length: 31 }, (_, i) => pt(`2026-08-${String(i + 1).padStart(2, '0')}`));
    const labels = trendAxisLabels(month, 'month');
    expect(labels[0]).toBe('1');
    expect(labels[5]).toBe('6');
    expect(labels[1]).toBe('');
    expect(labels[30]).toBe('31');
    expect(labels.filter(Boolean).length).toBeLessThanOrEqual(8);
  });

  it('names the months of a year', () => {
    const year = Array.from({ length: 12 }, (_, i) => pt(`2026-${String(i + 1).padStart(2, '0')}`));
    expect(trendAxisLabels(year, 'year')).toEqual([
      'ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec',
    ]);
  });
});

describe('trendDetailLabel', () => {
  it('names a weekday in full for a week', () => {
    expect(trendDetailLabel('2026-08-23', 'week')).toBe('duminică 23 aug');
  });
  it('drops the weekday for a month', () => {
    expect(trendDetailLabel('2026-08-23', 'month')).toBe('23 aug');
  });
  it('names the month for a year', () => {
    expect(trendDetailLabel('2026-08', 'year')).toBe('August');
  });
});

describe('trendSummary', () => {
  it('reads as one sentence, with the window named first', () => {
    expect(trendSummary('week', { cash: 4150, bookings: 18, occupancyAvgPct: 62 })).toBe(
      'Săptămâna asta · 62% ocupare medie · 4.150 lei · 18 rezervări'
    );
  });
  it('uses the singular for one reservation', () => {
    expect(trendSummary('month', { cash: 120, bookings: 1, occupancyAvgPct: 3 })).toBe(
      'Luna asta · 3% ocupare medie · 120 lei · 1 rezervare'
    );
  });
  it('falls back to the window name when the CMS sent no totals', () => {
    expect(trendSummary('year', null)).toBe('Anul acesta');
  });
});

describe('todayIndex', () => {
  it('finds today inside the week', () => {
    expect(todayIndex(WEEK, 'week', new Date(2026, 7, 22))).toBe(5);
  });
  it('finds the current month inside the year', () => {
    const year = Array.from({ length: 12 }, (_, i) => pt(`2026-${String(i + 1).padStart(2, '0')}`));
    expect(todayIndex(year, 'year', new Date(2026, 7, 22))).toBe(7);
  });
  it('is -1 when today is outside the window', () => {
    expect(todayIndex(WEEK, 'week', new Date(2026, 8, 30))).toBe(-1);
  });
});
