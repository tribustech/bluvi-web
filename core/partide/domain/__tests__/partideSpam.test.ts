import { describe, expect, it } from 'vitest';
import { CONFIRM_MS, COOLDOWN_MS, cooldownMessage, lastCaptureAgeMs, lastOutcomeAgeMs } from '../partideSpam';
import type { LocalEvent } from '../types';

// fish features/partide/helpers/__tests__/partideSpam.test.ts

const T0 = new Date(2026, 0, 1, 8, 0, 0).getTime();
type Ev = Pick<LocalEvent, 'rodIndex' | 'outcome' | 'occurredAt'>;
const ev = (over: Partial<Ev>): Ev => ({ rodIndex: 0, outcome: 'capture', occurredAt: T0, ...over });

describe('lastOutcomeAgeMs', () => {
  it('returns null when the rod has no event of that outcome', () => {
    expect(lastOutcomeAgeMs([ev({ outcome: 'capture' })], 0, 'lost', T0 + 5_000)).toBeNull();
  });

  it('measures age from the most recent event of the SAME outcome on that rod', () => {
    const events = [ev({ outcome: 'lost', occurredAt: T0 }), ev({ outcome: 'lost', occurredAt: T0 + 10_000 })];
    expect(lastOutcomeAgeMs(events, 0, 'lost', T0 + 13_000)).toBe(3_000);
  });

  it('is per-outcome — a blank does NOT count toward the lost cooldown (and vice versa)', () => {
    const events = [ev({ outcome: 'blank', occurredAt: T0 + 10_000 })];
    expect(lastOutcomeAgeMs(events, 0, 'lost', T0 + 11_000)).toBeNull();
    expect(lastOutcomeAgeMs(events, 0, 'blank', T0 + 11_000)).toBe(1_000);
  });

  it('ignores events on other rods and captures', () => {
    expect(lastOutcomeAgeMs([ev({ rodIndex: 1, outcome: 'lost', occurredAt: T0 + 9_000 })], 0, 'lost', T0 + 10_000)).toBeNull();
    expect(lastOutcomeAgeMs([ev({ outcome: 'capture', occurredAt: T0 + 9_000 })], 0, 'lost', T0 + 10_000)).toBeNull();
  });

  it('is under COOLDOWN_MS for a fresh repeat and >= for an aged one', () => {
    const events = [ev({ outcome: 'lost', occurredAt: T0 })];
    expect(lastOutcomeAgeMs(events, 0, 'lost', T0 + COOLDOWN_MS - 1)! < COOLDOWN_MS).toBe(true);
    expect(lastOutcomeAgeMs(events, 0, 'lost', T0 + COOLDOWN_MS)! < COOLDOWN_MS).toBe(false);
  });
});

describe('lastCaptureAgeMs', () => {
  it('measures age from the most recent capture in a numeric rod bucket', () => {
    const events = [ev({ occurredAt: T0 }), ev({ occurredAt: T0 + 20_000 })];
    expect(lastCaptureAgeMs(events, 0, T0 + 25_000)).toBe(5_000);
  });

  it('keeps different rods in separate buckets', () => {
    expect(lastCaptureAgeMs([ev({ rodIndex: 1, occurredAt: T0 + 20_000 })], 0, T0 + 25_000)).toBeNull();
  });

  it("groups no-rod captures under the 'free' bucket", () => {
    const events = [ev({ rodIndex: null, occurredAt: T0 + 20_000 })];
    expect(lastCaptureAgeMs(events, 'free', T0 + 25_000)).toBe(5_000);
    expect(lastCaptureAgeMs(events, 0, T0 + 25_000)).toBeNull();
  });

  it('does not count lost/blank toward the capture confirm window', () => {
    expect(lastCaptureAgeMs([ev({ outcome: 'lost', occurredAt: T0 + 20_000 })], 0, T0 + 25_000)).toBeNull();
  });
});

describe('cooldownMessage', () => {
  it('is a distinct, non-empty message per outcome mentioning the seconds', () => {
    const lost = cooldownMessage('lost', 12);
    const blank = cooldownMessage('blank', 12);
    expect(lost).toContain('12');
    expect(blank).toContain('12');
    expect(lost).not.toEqual(blank);
  });
});

describe('constants', () => {
  it('cooldown is 60s and confirm window is 30s', () => {
    expect(COOLDOWN_MS).toBe(60_000);
    expect(CONFIRM_MS).toBe(30_000);
  });
});
