import { describe, expect, it } from 'vitest';
import { combineDateAndTime, feeDigits, formatDateLabel, initialPickerDate } from './format';

describe('step-basics format helpers', () => {
  it('labels an empty date «Selectează data» and a set one «d MMM yyyy, HH:mm» (ro, local time)', () => {
    expect(formatDateLabel(undefined)).toBe('Selectează data');
    expect(formatDateLabel('nu e dată')).toBe('Selectează data');
    const d = new Date(2026, 10, 4, 7, 5);
    expect(formatDateLabel(d.toISOString())).toBe('4 noi 2026, 07:05');
    expect(formatDateLabel(new Date(2027, 0, 31, 23, 59).toISOString())).toBe('31 ian 2027, 23:59');
  });

  it('opens the picker on the field date, else now, without seconds', () => {
    const now = new Date(2026, 9, 8, 10, 15, 42, 7);
    expect(initialPickerDate(undefined, now)).toEqual(new Date(2026, 9, 8, 10, 15));
    expect(initialPickerDate(new Date(2026, 11, 1, 6, 0).toISOString(), now)).toEqual(new Date(2026, 11, 1, 6, 0));
  });

  it('combines a day with a time (fish combineDateAndTime)', () => {
    expect(combineDateAndTime(new Date(2026, 4, 2, 23, 0), new Date(2020, 0, 1, 6, 45, 30))).toEqual(new Date(2026, 4, 2, 6, 45));
  });

  it('keeps digits only in the fee', () => {
    expect(feeDigits('-1,5 lei')).toBe('15');
    expect(feeDigits('50.000')).toBe('50000');
    expect(feeDigits('')).toBe('');
  });
});
