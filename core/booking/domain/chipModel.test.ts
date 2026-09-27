import { describe, expect, it } from 'vitest';
import { buildBookingChips, chipAppearance, durationLabel, sortChips } from './chipModel';

describe('sortChips', () => {
  it('puts stand first regardless of input order', () => {
    const sorted = sortChips([
      { variant: 'payment', label: 'Numerar' },
      { variant: 'gate', label: 'La poartă' },
      { variant: 'stand', label: 'Standul 2' },
      { variant: 'duration', label: '12h zi' },
    ]);
    expect(sorted.map((c) => c.variant)).toEqual(['stand', 'duration', 'payment', 'gate']);
  });
});

describe('buildBookingChips', () => {
  it('labels a day session and keeps stand first', () => {
    expect(
      buildBookingChips({ standName: '2', hours: 12, startHour: 6 }),
    ).toEqual([
      { variant: 'stand', label: 'Standul 2' },
      { variant: 'duration', label: '12h zi' },
    ]);
  });

  it('labels a night session', () => {
    const chips = buildBookingChips({ standName: '7', hours: 12, startHour: 18 });
    expect(chips[1]).toEqual({ variant: 'duration', label: '12h noapte' });
  });

  it('does not day/night a 24h or longer booking', () => {
    expect(buildBookingChips({ standName: '5', hours: 24, startHour: 6 })[1].label).toBe('24h');
    expect(buildBookingChips({ standName: '5', hours: 48, startHour: 18 })[1].label).toBe('48h');
  });

  it('marks a walk-in', () => {
    const chips = buildBookingChips({ standName: '3', hours: 12, startHour: 6, isWalkIn: true });
    expect(chips).toContainEqual({ variant: 'gate', label: 'La poartă' });
  });

  it('handles a letter-coded stand and a missing stand', () => {
    expect(buildBookingChips({ standName: 'A10', hours: 12, startHour: 6 })[0].label).toBe('Standul A10');
    const noStand = buildBookingChips({ standName: null, hours: 12, startHour: 6 });
    expect(noStand.some((c) => c.variant === 'stand')).toBe(false);
  });

  it('treats an empty stand name as no stand', () => {
    const chips = buildBookingChips({ standName: '', hours: 12, startHour: 6 });
    expect(chips.some((c) => c.variant === 'stand')).toBe(false);
  });

  it('adds the payment chip with the exact diacritic label when paid offline', () => {
    const chips = buildBookingChips({ standName: '1', hours: 12, startHour: 6, paymentMode: 'offline' });
    expect(chips).toContainEqual({ variant: 'payment', label: 'Numerar' });
  });

  it('adds no payment chip for non-offline payment modes, or when omitted', () => {
    for (const paymentMode of ['deposit', 'full', undefined] as const) {
      const chips = buildBookingChips({ standName: '1', hours: 12, startHour: 6, paymentMode });
      expect(chips.some((c) => c.variant === 'payment')).toBe(false);
    }
  });

  it('orders all four chips stand, duration, payment, gate when every one is present', () => {
    const chips = buildBookingChips({
      standName: '1',
      hours: 12,
      startHour: 6,
      paymentMode: 'offline',
      isWalkIn: true,
    });
    expect(chips.map((c) => c.variant)).toEqual(['stand', 'duration', 'payment', 'gate']);
  });
});

describe('chipAppearance', () => {
  it('gives stand the indigo tint and never a gray fill', () => {
    expect(chipAppearance('stand').fill).toBe('#F0F3FD');
    for (const v of ['stand', 'duration', 'payment', 'gate'] as const) {
      expect(['#F2F2F2', '#E5E5E5']).not.toContain(chipAppearance(v).fill.toUpperCase());
    }
  });
});

describe('buildBookingChips includeDuration', () => {
  const base = { standName: '4', hours: 12, startHour: 18 };

  it('includes the duration chip by default', () => {
    expect(buildBookingChips(base).map(c => c.variant)).toContain('duration');
  });

  it('omits it when the caller prints the duration elsewhere', () => {
    const chips = buildBookingChips({ ...base, includeDuration: false });
    expect(chips.map(c => c.variant)).not.toContain('duration');
    expect(chips.map(c => c.variant)).toContain('stand');
  });
});

describe('durationLabel', () => {
  it('names the shift under 24h and stays plain at or above it', () => {
    expect(durationLabel(12, 18)).toBe('12h noapte');
    expect(durationLabel(12, 6)).toBe('12h zi');
    expect(durationLabel(36, 6)).toBe('36h');
  });
});

