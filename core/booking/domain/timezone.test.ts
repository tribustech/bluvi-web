import { describe, expect, it } from 'vitest';
// The lake-zone assertions below use Europe/Bucharest, deliberately different from the
// device clock, so they prove the helpers are tz-aware rather than just reading the
// device clock — and they pass in ANY device timezone (no TZ pinning required). The
// device-local fallback test recomputes its expected output from the same device-local
// primitives at runtime, so it is timezone-independent too.
import { formatLocalIso } from './dates';
import { zonedWallTimeToUtc, zonedWallTimeIso, zoneOffsetMinutes } from './timezone';
import { generateSlots } from './gridGeometry';


const BUCHAREST = 'Europe/Bucharest';

describe('zonedWallTimeToUtc', () => {
  it('maps a summer wall time (DST, UTC+3) to the correct UTC instant', () => {
    // 2026-07-15 is firmly in EEST (Eastern European Summer Time, UTC+3).
    // 18:00 local → 15:00Z.
    const utc = zonedWallTimeToUtc(2026, 7, 15, 18 * 60, BUCHAREST);
    expect(utc.toISOString()).toBe('2026-07-15T15:00:00.000Z');
  });

  it('maps a winter wall time (standard, UTC+2) to the correct UTC instant', () => {
    // 2026-01-15 is EET (standard, UTC+2). 18:00 local → 16:00Z.
    const utc = zonedWallTimeToUtc(2026, 1, 15, 18 * 60, BUCHAREST);
    expect(utc.toISOString()).toBe('2026-01-15T16:00:00.000Z');
  });

  it('zoneOffsetMinutes reflects the DST offset (+180 summer, +120 winter)', () => {
    expect(zoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'), BUCHAREST)).toBe(180);
    expect(zoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'), BUCHAREST)).toBe(120);
  });
});

describe('zonedWallTimeIso', () => {
  it('keeps the literal wall clock + carries the lake-zone offset (summer)', () => {
    // Literal reads 06:00 (lake wall time), offset +03:00, and the encoded instant
    // is correct regardless of the device being in America/New_York.
    const iso = zonedWallTimeIso(2026, 7, 15, 6 * 60, BUCHAREST);
    expect(iso).toBe('2026-07-15T06:00:00+03:00');
    expect(new Date(iso).toISOString()).toBe('2026-07-15T03:00:00.000Z');
  });

  it('keeps the literal wall clock + carries the lake-zone offset (winter)', () => {
    const iso = zonedWallTimeIso(2026, 1, 15, 6 * 60, BUCHAREST);
    expect(iso).toBe('2026-01-15T06:00:00+02:00');
    expect(new Date(iso).toISOString()).toBe('2026-01-15T04:00:00.000Z');
  });
});

describe('generateSlots — timezone aware vs device-local fallback', () => {
  const slotStartTimes = ['06:00', '18:00'];
  const incrementHours = 12;

  it('with a lake timezone, slot instants are anchored to the LAKE clock (not the device)', () => {
    // Window covers a single summer lake-day. On an America/New_York device, the
    // device-local path would otherwise produce New-York-offset instants.
    const slots = generateSlots({
      from: '2026-07-15T00:00:00+03:00',
      to: '2026-07-16T00:00:00+03:00',
      slotStartTimes,
      incrementHours,
      timezone: BUCHAREST,
    });
    const starts = slots.map(s => s.start);
    expect(starts).toEqual(['2026-07-15T06:00:00+03:00', '2026-07-15T18:00:00+03:00']);
    // The encoded UTC instant of the 06:00 lake slot is 03:00Z (UTC+3).
    expect(new Date(slots[0].start).toISOString()).toBe('2026-07-15T03:00:00.000Z');
    // 06:00 + 12h = 18:00 lake → 15:00Z, expressed back in lake wall clock.
    expect(slots[0].end).toBe('2026-07-15T18:00:00+03:00');
    expect(new Date(slots[0].end).toISOString()).toBe('2026-07-15T15:00:00.000Z');
  });

  it('with NO timezone, falls back to the exact device-local output (regression guard)', () => {
    // Anchor on a DEVICE-LOCAL midnight (resolved at runtime) so the window spans
    // exactly one local calendar day in ANY device timezone — no hard-coded offset.
    const baseLocalMidnight = new Date('2026-07-15T00:00:00');
    const opts = {
      from: baseLocalMidnight.toISOString(),
      to: new Date('2026-07-16T00:00:00').toISOString(),
      slotStartTimes,
      incrementHours,
    };
    const slots = generateSlots(opts);

    // Expected output recomputed from the same device-local primitives the fallback uses
    // (startOfDay + literal HH:mm wall time), so it matches in any device timezone.
    const at = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date(baseLocalMidnight);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const dur = incrementHours * 3_600_000;
    const expected = [
      { start: formatLocalIso(at('06:00')), end: formatLocalIso(new Date(at('06:00').getTime() + dur)) },
      { start: formatLocalIso(at('18:00')), end: formatLocalIso(new Date(at('18:00').getTime() + dur)) },
    ];
    expect(slots).toEqual(expected);

    // An empty/whitespace timezone is treated as absent → also takes the fallback.
    expect(generateSlots({ ...opts, timezone: '   ' })).toEqual(slots);
  });
});
