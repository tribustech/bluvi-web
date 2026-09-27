import { describe, it, expect } from 'vitest';
import {
  standLabel,
  agoRo,
  barFraction,
  catchesLabel,
  fmtRange,
  fmtSpan,
  isDuelLeader,
  liveCardShape,
  standSuffix,
  venueCountLabel,
  venueSubtitle,
} from '../cardModel';

describe('liveCardShape', () => {
  it('is solo for exactly one live session', () => {
    expect(liveCardShape(1)).toBe('solo');
  });
  it('is duel for exactly two', () => {
    expect(liveCardShape(2)).toBe('duel');
  });
  it('is leaderboard for more than two', () => {
    expect(liveCardShape(3)).toBe('leaderboard');
    expect(liveCardShape(9)).toBe('leaderboard');
  });
});

describe('venueCountLabel', () => {
  it('counts standuri when every session has a stand', () => {
    expect(venueCountLabel([{ standName: 'Stand 1' }, { standName: 'Stand 2' }, { standName: 'Stand 3' }], false))
      .toBe('3 standuri în întrecere');
  });
  it('falls back to partide when any session has no stand', () => {
    expect(venueCountLabel([{ standName: 'Stand 1' }, { standName: null }, { standName: 'Stand 3' }], false))
      .toBe('3 partide în întrecere');
  });
  it('uses the duel wording for two sessions', () => {
    expect(venueCountLabel([{ standName: 'Stand 1' }, { standName: 'Stand 2' }], true))
      .toBe('2 standuri în duel');
    expect(venueCountLabel([{ standName: null }, { standName: 'Stand 2' }], true))
      .toBe('2 partide în duel');
  });
  it('does not claim "standuri" for an empty session list — `[].every()` is vacuously true, so the deliberate `sessions.length > 0` guard must survive', () => {
    expect(venueCountLabel([], false)).toBe('0 partide în întrecere');
  });
});

describe('standLabel', () => {
  it('prefixes the noun for a bare numeric stand name', () => {
    expect(standLabel('7')).toBe('Stand 7');
    expect(standLabel('12')).toBe('Stand 12');
  });
  it('prefixes an alphanumeric stand name too', () => {
    expect(standLabel('4B')).toBe('Stand 4B');
    expect(standLabel('A9')).toBe('Stand A9');
  });
  it('prefixes a descriptive name — a picked stand always reads as a stand', () => {
    expect(standLabel('Ponton A')).toBe('Stand Ponton A');
    expect(standLabel('Insula')).toBe('Stand Insula');
  });
  it('does not double up on a name that already carries the noun', () => {
    expect(standLabel('Stand 3')).toBe('Stand 3');
    expect(standLabel('stand 3')).toBe('stand 3');
    expect(standLabel('Standard')).toBe('Stand Standard');
  });
  it('trims and treats blank as absent', () => {
    expect(standLabel('  9 ')).toBe('Stand 9');
    expect(standLabel('   ')).toBeNull();
    expect(standLabel('')).toBeNull();
    expect(standLabel(null)).toBeNull();
  });
});

describe('standSuffix', () => {
  it('prefixes with a separator when a stand exists', () => {
    expect(standSuffix('7')).toBe(' · Stand 7');
  });
  it('is empty when there is no stand', () => {
    expect(standSuffix(null)).toBe('');
  });
});

describe('barFraction', () => {
  it('is 1 for the leader', () => {
    expect(barFraction(15, 15)).toBe(1);
  });
  it('is proportional below the leader', () => {
    expect(barFraction(9, 15)).toBeCloseTo(0.6);
  });
  it('is 0 when the session has no total', () => {
    expect(barFraction(null, 15)).toBe(0);
  });
  it('is 0 rather than NaN when the leader has no total', () => {
    expect(barFraction(null, null)).toBe(0);
    expect(barFraction(3, 0)).toBe(0);
  });
});

describe('venueSubtitle', () => {
  it('joins locality and stand', () => {
    expect(venueSubtitle('Ilfov', '3')).toBe('Ilfov · Stand 3');
  });
  it('drops the missing half', () => {
    expect(venueSubtitle('Ilfov', null)).toBe('Ilfov');
    expect(venueSubtitle(null, '3')).toBe('Stand 3');
    expect(venueSubtitle(null, null)).toBe('');
  });
});

describe('catchesLabel', () => {
  it('is singular at one', () => {
    expect(catchesLabel(1)).toBe('1 captură');
  });
  it('is plural otherwise', () => {
    expect(catchesLabel(0)).toBe('0 capturi');
    expect(catchesLabel(9)).toBe('9 capturi');
  });
  it('is null when unknown', () => {
    expect(catchesLabel(null)).toBeNull();
  });
});

describe('fmtSpan', () => {
  it('renders minutes-only under an hour, unpadded', () => {
    expect(fmtSpan(40 * 60_000)).toBe('40 min');
    expect(fmtSpan(0)).toBe('0 min');
  });
  it('zero-pads minutes once there is an hour part, even at :00', () => {
    expect(fmtSpan(65 * 60_000)).toBe('1h 05m');
    expect(fmtSpan(60 * 60_000)).toBe('1h 00m');
    expect(fmtSpan((6 * 60 + 40) * 60_000)).toBe('6h 40m');
  });
  it('never goes negative on a clock skew', () => {
    expect(fmtSpan(-5000)).toBe('0 min');
  });
});

describe('fmtRange', () => {
  it('formats a same-day start/end pair with the RO month abbreviation', () => {
    const started = new Date(2026, 6, 26, 6, 40).getTime(); // 26 iul, 06:40
    const ended = new Date(2026, 6, 26, 18, 10).getTime(); // 18:10
    expect(fmtRange(started, ended)).toBe('26 IUL · 06:40 – 18:10');
  });
  it('accepts ISO strings the same as epoch ms', () => {
    expect(fmtRange('2026-07-26T06:40:00', '2026-07-26T18:10:00')).toBe('26 IUL · 06:40 – 18:10');
  });
});

describe('agoRo', () => {
  const now = new Date(2026, 6, 26, 12, 0).getTime();
  it('is null when there is no timestamp', () => {
    expect(agoRo(now, null)).toBeNull();
    expect(agoRo(now, undefined)).toBeNull();
  });
  it('matches fmtSpan under an hour', () => {
    const iso = new Date(now - 18 * 60_000).toISOString();
    expect(agoRo(now, iso)).toBe('acum 18 min');
  });
  it('pads minutes past an hour exactly like fmtSpan (never drops :00)', () => {
    const isoOnTheHour = new Date(now - 60 * 60_000).toISOString();
    expect(agoRo(now, isoOnTheHour)).toBe('acum 1h 00m');
    const isoWithMinutes = new Date(now - 65 * 60_000).toISOString();
    expect(agoRo(now, isoWithMinutes)).toBe('acum 1h 05m');
  });
});

describe('isDuelLeader', () => {
  it('the strictly bigger total leads (3.0 vs 2.4, called from both sides)', () => {
    expect(isDuelLeader(3.0, 2.4)).toBe(true);
    expect(isDuelLeader(2.4, 3.0)).toBe(false);
  });
  it('an exact non-zero tie highlights neither side — not "both", not "either"', () => {
    expect(isDuelLeader(5, 5)).toBe(false);
  });
  it('two null totals (no data on either side) tie — neither side leads', () => {
    // A broken implementation that defaults a null total to 0 before
    // comparing (`(mineKg ?? 0) >= (otherKg ?? 0)`) would return `true` here
    // for BOTH sides, since 0 >= 0 — exactly the "both leaders" bug contract
    // 1 flags.
    expect(isDuelLeader(null, null)).toBe(false);
  });
  it('a measured total beats a null (no data yet) side — but not vice versa', () => {
    expect(isDuelLeader(5, null)).toBe(true);
    expect(isDuelLeader(null, 5)).toBe(false);
  });
});
