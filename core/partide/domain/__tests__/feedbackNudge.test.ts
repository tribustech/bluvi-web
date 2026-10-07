import { describe, expect, it } from 'vitest';
import {
  NUDGE_HISTORY_LIMIT,
  NUDGE_MIN_CAPTURES,
  NUDGE_MIN_ELAPSED_MS,
  nudgeThresholdMet,
  parseNudgedSessions,
  rememberNudged,
  wasNudged,
} from '../feedbackNudge';

describe('nudgeThresholdMet (fish helpers/feedbackNudge.ts)', () => {
  it('3 captures or 4 h, whichever comes first', () => {
    expect(nudgeThresholdMet({ captures: NUDGE_MIN_CAPTURES, elapsedMs: 0 })).toBe(true);
    expect(nudgeThresholdMet({ captures: 0, elapsedMs: NUDGE_MIN_ELAPSED_MS })).toBe(true);
    expect(nudgeThresholdMet({ captures: 2, elapsedMs: NUDGE_MIN_ELAPSED_MS - 1 })).toBe(false);
  });
});

describe('parseNudgedSessions', () => {
  it('missing / broken / wrong shapes degrade to an empty list', () => {
    expect(parseNudgedSessions(null)).toEqual([]);
    expect(parseNudgedSessions('{oops')).toEqual([]);
    expect(parseNudgedSessions('{"a":1}')).toEqual([]);
  });
  it('keeps only non-empty strings', () => {
    expect(parseNudgedSessions(JSON.stringify(['a', '', 3, null, 'b']))).toEqual(['a', 'b']);
  });
});

describe('wasNudged / rememberNudged', () => {
  it('records once, newest last', () => {
    const list = rememberNudged(rememberNudged(['a', 'b'], 'a'), 'c');
    expect(list).toEqual(['b', 'a', 'c']);
    expect(wasNudged(list, 'a')).toBe(true);
    expect(wasNudged(list, 'z')).toBe(false);
  });
  it('trims to the history limit, dropping the oldest', () => {
    const many = Array.from({ length: NUDGE_HISTORY_LIMIT }, (_, i) => `s${i}`);
    const next = rememberNudged(many, 'new');
    expect(next).toHaveLength(NUDGE_HISTORY_LIMIT);
    expect(next[0]).toBe('s1');
    expect(next.at(-1)).toBe('new');
  });
});
