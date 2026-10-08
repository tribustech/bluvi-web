import { describe, expect, it } from 'vitest';
import { closedDateLabel, pastPollFacts, pollsCount, votesLabel } from './format';

describe('participant.polls-past format', () => {
  it('c4 date: closedAt first, else closesAt, ro-RO long month in Romania time', () => {
    expect(closedDateLabel({ closedAt: '2026-06-01T20:00:00.000Z', closesAt: '2026-07-20T20:00:00.000Z' })).toBe('1 iunie 2026');
    expect(closedDateLabel({ closedAt: null, closesAt: '2026-07-20T20:00:00.000Z' })).toBe('20 iulie 2026');
    expect(closedDateLabel({ closesAt: '2026-12-05T10:00:00.000Z' })).toBe('5 decembrie 2026');
    // 23:30 UTC on 31 January is already 1 February in Romania (UTC+2).
    expect(closedDateLabel({ closedAt: '2026-01-31T23:30:00.000Z', closesAt: null })).toBe('1 februarie 2026');
  });

  it('c4 date: omitted when neither is set or the value is unreadable', () => {
    expect(closedDateLabel({ closedAt: null, closesAt: null })).toBeNull();
    expect(closedDateLabel({ closesAt: null })).toBeNull();
    expect(closedDateLabel({ closedAt: 'not a date', closesAt: null })).toBeNull();
  });

  it('c4 votes: Romanian plurals', () => {
    expect(votesLabel(0)).toBe('0 voturi');
    expect(votesLabel(1)).toBe('1 vot');
    expect(votesLabel(3)).toBe('3 voturi');
    expect(votesLabel(19)).toBe('19 voturi');
    expect(votesLabel(20)).toBe('20 de voturi');
    expect(votesLabel(101)).toBe('101 voturi');
  });

  it('c4 facts line: «Închis · {date} · {n} vot/voturi», no empty date slot', () => {
    expect(pastPollFacts({ closedAt: '2026-06-01T20:00:00.000Z', closesAt: null, totalVotes: 1 })).toBe('Închis · 1 iunie 2026 · 1 vot');
    expect(pastPollFacts({ closedAt: null, closesAt: null, totalVotes: 24 })).toBe('Închis · 24 de voturi');
  });

  it('footer total', () => {
    expect(pollsCount(1)).toBe('1 sondaj');
    expect(pollsCount(12)).toBe('12 sondaje');
    expect(pollsCount(23)).toBe('23 de sondaje');
  });
});
