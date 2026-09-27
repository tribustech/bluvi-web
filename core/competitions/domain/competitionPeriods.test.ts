import { describe, expect, it } from 'vitest';
import {
  customPeriodLabel,
  customPeriodValue,
  parseCustomPeriod,
  periodChipLabel,
  periodFitsStatus,
  periodOptions,
} from './competitionPeriods';

/**
 * The helper reads local calendar parts, so every `now` here is built from local
 * components rather than an ISO instant: `new Date('2026-09-23T06:00:00.000Z')`
 * is the 23rd in Bucharest but the 22nd in America — the plan's instant, without
 * the machine's timezone deciding whether the suite passes.
 */
const NOW = new Date(2026, 8, 23, 9, 0, 0); // Wednesday 23 September 2026

describe('periodOptions', () => {
  it('looks forward for competitions that have not started', () => {
    expect(periodOptions(NOW, 'notStarted').map(o => o.value)).toEqual([
      'all',
      'next7',
      'weekend',
      '2026-09',
      '2026-10',
    ]);
  });

  it('looks backward for finished ones, and drops the two windows that open today', () => {
    // "Încheiate" next to "Următoarele 7 zile" describes nothing, so it is not
    // offered at all rather than offered and empty.
    expect(periodOptions(NOW, 'completed').map(o => o.value)).toEqual([
      'all',
      '2026-09',
      '2026-08',
      '2026-07',
    ]);
  });

  it('offers both directions for a mixed list', () => {
    expect(periodOptions(NOW, 'all').map(o => o.value)).toEqual([
      'all',
      'next7',
      'weekend',
      '2026-09',
      '2026-08',
    ]);
  });

  it('dates the weekend option', () => {
    expect(periodOptions(NOW).find(o => o.value === 'weekend')!.label).toBe('Weekendul acesta · 26–27 sept.');
  });

  it('labels every option', () => {
    expect(periodOptions(NOW, 'notStarted').map(o => o.label)).toEqual([
      'Oricând',
      'Următoarele 7 zile',
      'Weekendul acesta · 26–27 sept.',
      'Septembrie 2026',
      'Octombrie 2026',
    ]);
  });

  it('generates the months from now instead of hardcoding a year', () => {
    const december = new Date(2026, 11, 4, 9, 0, 0);
    expect(periodOptions(december, 'notStarted').map(o => o.value)).toEqual([
      'all',
      'next7',
      'weekend',
      '2026-12',
      '2027-01',
    ]);
    expect(periodOptions(december, 'notStarted').slice(3).map(o => o.label)).toEqual([
      'Decembrie 2026',
      'Ianuarie 2027',
    ]);
    // And backwards across the same year boundary.
    expect(periodOptions(new Date(2027, 0, 4, 9, 0, 0), 'completed').map(o => o.value)).toEqual([
      'all',
      '2027-01',
      '2026-12',
      '2026-11',
    ]);
  });

  it('keeps today inside the weekend when today is Saturday', () => {
    const saturday = new Date(2026, 8, 26, 9, 0, 0);
    expect(periodOptions(saturday).find(o => o.value === 'weekend')!.label).toBe('Weekendul acesta · 26–27 sept.');
  });

  it('keeps today inside the weekend when today is Sunday', () => {
    const sunday = new Date(2026, 8, 27, 9, 0, 0);
    expect(periodOptions(sunday).find(o => o.value === 'weekend')!.label).toBe('Weekendul acesta · 26–27 sept.');
  });

  it('names both months when the weekend straddles them', () => {
    const lastWeekOfOctober = new Date(2026, 9, 28, 9, 0, 0); // Wednesday 28 October 2026
    expect(periodOptions(lastWeekOfOctober).find(o => o.value === 'weekend')!.label).toBe(
      'Weekendul acesta · 31 oct.–1 nov.'
    );
  });
});

describe('periodChipLabel', () => {
  it('labels the chip', () => {
    expect(periodChipLabel('next7', NOW)).toBe('Următoarele 7 zile');
    expect(periodChipLabel('all', NOW)).toBe('Perioadă');
  });

  it('keeps the weekend chip short', () => {
    expect(periodChipLabel('weekend', NOW)).toBe('Weekendul acesta');
  });

  it('names a month, including one that is no longer offered', () => {
    expect(periodChipLabel('2026-09', NOW)).toBe('Septembrie 2026');
    expect(periodChipLabel('2026-08', NOW)).toBe('August 2026');
  });

  it('falls back to the neutral label for a value it cannot read', () => {
    expect(periodChipLabel('2026-13', NOW)).toBe('Perioadă');
    expect(periodChipLabel('lol', NOW)).toBe('Perioadă');
    expect(periodChipLabel('', NOW)).toBe('Perioadă');
  });

  it('names a hand-picked range', () => {
    expect(periodChipLabel('2026-09-25..2026-10-02', NOW)).toBe('25 sept.–2 oct.');
    expect(periodChipLabel('2026-05-01..2026-05-03', NOW)).toBe('1–3 mai');
  });
});

describe('customPeriodValue', () => {
  it('writes two zero-padded local days', () => {
    expect(customPeriodValue(new Date(2026, 4, 1), new Date(2026, 4, 3))).toBe('2026-05-01..2026-05-03');
  });

  it('reads local parts, not the UTC instant', () => {
    // 23:30 local on the 1st is already the 2nd in UTC east of Greenwich and
    // still the 1st west of it; the day the user tapped is the local one.
    expect(customPeriodValue(new Date(2026, 4, 1, 23, 30), new Date(2026, 4, 1, 23, 30))).toBe(
      '2026-05-01..2026-05-01'
    );
  });

  it('orders the two days, because the CMS drops a backwards range entirely', () => {
    expect(customPeriodValue(new Date(2026, 4, 10), new Date(2026, 4, 1))).toBe('2026-05-01..2026-05-10');
  });
});

describe('parseCustomPeriod', () => {
  it('reads both ends as local midnights', () => {
    const range = parseCustomPeriod('2026-09-25..2026-10-02')!;
    expect(range.from).toEqual(new Date(2026, 8, 25));
    expect(range.to).toEqual(new Date(2026, 9, 2));
  });

  it('accepts a single day', () => {
    expect(parseCustomPeriod('2026-05-01..2026-05-01')).not.toBeNull();
  });

  it('refuses what the CMS also refuses', () => {
    expect(parseCustomPeriod('2026-02-30..2026-03-02')).toBeNull();
    expect(parseCustomPeriod('2026-13-01..2026-13-02')).toBeNull();
    expect(parseCustomPeriod('2026-05-10..2026-05-01')).toBeNull();
    expect(parseCustomPeriod('2026-05-01..')).toBeNull();
    expect(parseCustomPeriod('2026-05-01-2026-05-03')).toBeNull();
    expect(parseCustomPeriod('2026-05')).toBeNull();
    expect(parseCustomPeriod('weekend')).toBeNull();
  });
});

describe('customPeriodLabel', () => {
  it('drops the repeated month inside one month, like the weekend pill', () => {
    expect(customPeriodLabel(new Date(2026, 8, 26), new Date(2026, 8, 27), NOW)).toBe('26–27 sept.');
  });

  it('names both months across two', () => {
    expect(customPeriodLabel(new Date(2026, 9, 31), new Date(2026, 10, 1), NOW)).toBe('31 oct.–1 nov.');
  });

  it('says a single day once', () => {
    expect(customPeriodLabel(new Date(2026, 8, 26), new Date(2026, 8, 26), NOW)).toBe('26 sept.');
  });

  it('adds the year once the range leaves the current one', () => {
    expect(customPeriodLabel(new Date(2026, 11, 28), new Date(2027, 0, 3), NOW)).toBe('28 dec. 2026–3 ian. 2027');
    expect(customPeriodLabel(new Date(2027, 0, 3), new Date(2027, 0, 5), NOW)).toBe('3–5 ian. 2027');
    expect(customPeriodLabel(new Date(2027, 0, 3), new Date(2027, 0, 3), NOW)).toBe('3 ian. 2027');
  });
});

describe('periodFitsStatus', () => {
  it('lets anything stand next to Oricând and next to a mixed or live list', () => {
    expect(periodFitsStatus('all', 'completed', NOW)).toBe(true);
    expect(periodFitsStatus('next7', 'all', NOW)).toBe(true);
    expect(periodFitsStatus('next7', 'started', NOW)).toBe(true);
  });

  it('refuses the two forward windows for a finished competition', () => {
    expect(periodFitsStatus('next7', 'completed', NOW)).toBe(false);
    expect(periodFitsStatus('weekend', 'completed', NOW)).toBe(false);
    expect(periodFitsStatus('next7', 'notStarted', NOW)).toBe(true);
  });

  it('judges a month by where it sits relative to today', () => {
    expect(periodFitsStatus('2026-10', 'completed', NOW)).toBe(false);
    expect(periodFitsStatus('2026-08', 'completed', NOW)).toBe(true);
    expect(periodFitsStatus('2026-08', 'notStarted', NOW)).toBe(false);
    expect(periodFitsStatus('2026-10', 'notStarted', NOW)).toBe(true);
    // The month we are standing in works either way — part of it is behind us.
    expect(periodFitsStatus('2026-09', 'completed', NOW)).toBe(true);
    expect(periodFitsStatus('2026-09', 'notStarted', NOW)).toBe(true);
  });

  it('judges a hand-picked range the same way', () => {
    expect(periodFitsStatus('2026-10-01..2026-10-03', 'completed', NOW)).toBe(false);
    expect(periodFitsStatus('2026-08-01..2026-08-03', 'notStarted', NOW)).toBe(false);
    expect(periodFitsStatus('2026-09-20..2026-09-28', 'completed', NOW)).toBe(true);
    expect(periodFitsStatus('2026-09-20..2026-09-28', 'notStarted', NOW)).toBe(true);
  });
});
