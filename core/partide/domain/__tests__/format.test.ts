import { describe, it, expect } from 'vitest';
import {
  fmtClock,
  fmtCountdown,
  fmtDurationShort,
  fmtElapsedPill,
  fmtElapsedShort,
  fmtEndedSubtitle,
  fmtKg,
  fmtKgStat,
  fmtMonthHeader,
  fmtPastCardMeta,
  fmtPlannedDuration,
  fmtRecordDate,
  pad2,
} from '../format';

describe('pad2', () => {
  it('zero-pads to 2 digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
    expect(pad2(42)).toBe('42');
  });
});

describe('fmtKg', () => {
  it('formats with a comma decimal, 1–3 places', () => {
    expect(fmtKg(6.4)).toBe('6,4');
    expect(fmtKg(6)).toBe('6,0');
    expect(fmtKg(0)).toBe('0,0');
    expect(fmtKg(6.45)).toBe('6,45');
    expect(fmtKg(3.125)).toBe('3,125');
    expect(fmtKg(6.449)).toBe('6,449');
    expect(fmtKg(2.1204)).toBe('2,12');
    expect(fmtKg(5.0001)).toBe('5,0');
  });
});

describe('fmtKgStat', () => {
  it('keeps a catch-sized number exact', () => {
    expect(fmtKgStat(8.4)).toEqual({ value: '8,4', unit: 'kg' });
    expect(fmtKgStat(60)).toEqual({ value: '60,0', unit: 'kg' });
    expect(fmtKgStat(21.35)).toEqual({ value: '21,35', unit: 'kg' });
    expect(fmtKgStat(0)).toEqual({ value: '0,0', unit: 'kg' });
  });

  it('drops the decimals once the number reaches three digits', () => {
    expect(fmtKgStat(99.4)).toEqual({ value: '99,4', unit: 'kg' });
    expect(fmtKgStat(100)).toEqual({ value: '100', unit: 'kg' });
    expect(fmtKgStat(204.33)).toEqual({ value: '204', unit: 'kg' });
    expect(fmtKgStat(999.4)).toEqual({ value: '999', unit: 'kg' });
    // the band is chosen after rounding, so this is a tonne, not "1000" kg
    expect(fmtKgStat(999.99)).toEqual({ value: '1,0', unit: 't' });
  });

  it('switches to tonnes past a thousand kilos', () => {
    expect(fmtKgStat(1000)).toEqual({ value: '1,0', unit: 't' });
    expect(fmtKgStat(1204.33)).toEqual({ value: '1,2', unit: 't' });
    expect(fmtKgStat(12750)).toEqual({ value: '12,8', unit: 't' });
    // past a hundred tonnes the decimal is dropped rather than overflowing
    expect(fmtKgStat(999999)).toEqual({ value: '1000', unit: 't' });
  });

  it('stays within the cell however large the weight gets', () => {
    // "99,99" is the widest the scale allows — the hundreds and tonnes bands
    // are deliberately shorter, so the cell never has to grow past a value it
    // already renders today.
    for (const kg of [0, 8.4, 21.35, 99.99, 100, 204.33, 999.99, 1000, 1204, 12750, 999999]) {
      expect(fmtKgStat(kg).value.length).toBeLessThanOrEqual(5);
    }
  });

  it('clamps a negative total rather than rendering a minus sign', () => {
    expect(fmtKgStat(-5)).toEqual({ value: '0,0', unit: 'kg' });
  });
});

describe('fmtCountdown', () => {
  it('formats ms as HH:MM:SS, clamped at 0', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
    expect(fmtCountdown(-5000)).toBe('00:00:00');
    expect(fmtCountdown(30 * 60_000)).toBe('00:30:00');
    expect(fmtCountdown(3_661_000)).toBe('01:01:01');
  });
});

describe('fmtElapsedShort', () => {
  it('formats ms as H:MM', () => {
    expect(fmtElapsedShort(0)).toBe('00:00');
    expect(fmtElapsedShort((4 * 60 + 12) * 60_000)).toBe('04:12');
  });
});

describe('fmtClock', () => {
  it('formats an epoch as local HH:MM', () => {
    const t = new Date(2025, 0, 1, 7, 14, 0).getTime();
    expect(fmtClock(t)).toBe('07:14');
  });
});

describe('fmtElapsedPill', () => {
  it('formats ≥1h as H:MM', () => {
    expect(fmtElapsedPill(3 * 3600_000 + 38 * 60_000)).toBe('3:38');
  });
  it('formats <1h as MM:SS', () => {
    expect(fmtElapsedPill(12 * 60_000 + 5_000)).toBe('12:05');
  });
  it('clamps negatives to 00:00', () => {
    expect(fmtElapsedPill(-5)).toBe('00:00');
  });
});

describe('fmtMonthHeader', () => {
  it('formats a September date as the ro-RO uppercase month + year', () => {
    expect(fmtMonthHeader(new Date(2025, 8, 15).getTime())).toBe('SEPTEMBRIE 2025');
  });
  it('formats a January date in a different year', () => {
    expect(fmtMonthHeader(new Date(2026, 0, 3).getTime())).toBe('IANUARIE 2026');
  });
});

describe('fmtDurationShort', () => {
  it('rounds to whole hours when ≥1h', () => {
    expect(fmtDurationShort(6 * 3_600_000)).toBe('6h');
  });
  it('shows minutes when under an hour', () => {
    expect(fmtDurationShort(8 * 60_000)).toBe('8m');
  });
});

describe('fmtPlannedDuration', () => {
  const H = 3_600_000;
  it('stays in hours under a day', () => {
    expect(fmtPlannedDuration(12 * H)).toBe('12h');
    expect(fmtPlannedDuration(23 * H)).toBe('23h');
  });
  it('uses the singular for exactly one day', () => {
    expect(fmtPlannedDuration(24 * H)).toBe('1 zi');
  });
  it('uses whole days when there is no remainder', () => {
    expect(fmtPlannedDuration(48 * H)).toBe('2 zile');
    expect(fmtPlannedDuration(168 * H)).toBe('7 zile');
  });
  it('appends leftover hours', () => {
    expect(fmtPlannedDuration(76 * H)).toBe('3 zile 4h');
  });
  it('keeps minutes from the old hours+minutes wheel', () => {
    expect(fmtPlannedDuration(1.5 * H)).toBe('1h 30m');
    expect(fmtPlannedDuration(0.75 * H)).toBe('45m');
    expect(fmtPlannedDuration(25.5 * H)).toBe('1 zi 1h 30m');
    expect(fmtPlannedDuration(24 * H + 30 * 60_000)).toBe('1 zi 30m');
  });
  it('clamps negatives to zero', () => {
    expect(fmtPlannedDuration(-5 * H)).toBe('0m');
  });
});

describe('fmtEndedSubtitle', () => {
  it('matches fmtPastCardMeta duration rule for a sub-hour session', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    const endedAt = startedAt + 8 * 60_000;
    expect(fmtEndedSubtitle(startedAt, endedAt)).toBe('17 sept. · 8m');
  });
});

describe('fmtPastCardMeta', () => {
  it('rounds duration to whole hours when ≥1h', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    const endedAt = startedAt + 6 * 3_600_000;
    expect(fmtPastCardMeta({ startedAt, endedAt }, 4)).toBe('17 SEP · 6h · 4 capturi');
  });
  it('shows minutes when the duration is under an hour', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    const endedAt = startedAt + 45 * 60_000;
    expect(fmtPastCardMeta({ startedAt, endedAt }, 2)).toBe('17 SEP · 45m · 2 capturi');
  });
  it('renders the capture count regardless of pluralization', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    const endedAt = startedAt + 3_600_000;
    expect(fmtPastCardMeta({ startedAt, endedAt }, 0)).toBe('17 SEP · 1h · 0 capturi');
  });
  it('labels a never-ended session as în desfășurare instead of a zero duration', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    expect(fmtPastCardMeta({ startedAt, endedAt: null }, 13)).toBe('17 SEP · în desfășurare · 13 capturi');
  });
  it('labels a never-ended session without captures suffix when includeCaptures is false', () => {
    const startedAt = new Date(2025, 8, 17, 10, 0, 0).getTime();
    expect(fmtPastCardMeta({ startedAt, endedAt: null }, 0, false)).toBe('17 SEP · în desfășurare');
  });
});

describe('fmtRecordDate', () => {
  it('formats an ISO timestamp as "day MON" (RO, uppercase)', () => {
    expect(fmtRecordDate(new Date(2026, 6, 12, 9, 0, 0).toISOString())).toBe('12 IUL');
  });
});
