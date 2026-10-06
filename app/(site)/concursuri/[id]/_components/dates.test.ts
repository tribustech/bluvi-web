import { describe, expect, it } from 'vitest';
import { competitionDuration, dayMonthTime, timeAgo, timeBadge } from './dates';

describe('timeBadge (fish CompetitionInfo TimeBadge)', () => {
  it('is the Bucharest time over the day, in sentence case (short and long)', () => {
    expect(timeBadge('2026-10-04T04:00:00Z')).toEqual({ time: '07:00', date: 'dum, 4 oct 2026', dateLong: 'duminică, 4 octombrie 2026' });
    expect(timeBadge('2026-04-28T14:17:00Z').date).toBe('mar, 28 apr 2026');
    expect(timeBadge('2026-05-15T14:17:00Z').date).toBe('vin, 15 mai 2026');
    expect(timeBadge('nope')).toEqual({ time: '', date: '', dateLong: '' });
  });
});

describe('competitionDuration (fish getCompetitionDuration, Romanian agreement)', () => {
  const from = '2026-05-15T14:17:00Z';
  const plus = (h: number) => new Date(Date.parse(from) + h * 3_600_000).toISOString();
  it('counts hours up to 72, with «de» from 20', () => {
    expect(competitionDuration(from, plus(1))).toBe('1 oră');
    expect(competitionDuration(from, plus(19))).toBe('19 ore');
    expect(competitionDuration(from, plus(20))).toBe('20 de ore');
    expect(competitionDuration(from, plus(51))).toBe('51 de ore');
    expect(competitionDuration(from, plus(72))).toBe('72 de ore');
  });
  it('counts days (and the hours left) above 72 hours', () => {
    expect(competitionDuration(from, plus(96))).toBe('4 zile');
    expect(competitionDuration(from, plus(97))).toBe('4 zile și 1 oră');
    expect(competitionDuration(from, plus(24 * 21 + 20))).toBe('21 de zile și 20 de ore');
  });
});

describe('dayMonthTime (fish ScaleItem «Finalizat la»)', () => {
  it('is «d MMM, HH:mm» in Romanian', () => {
    expect(dayMonthTime('2026-04-30T10:58:02.357Z')).toBe('30 apr., 13:58');
  });
});

describe('timeAgo (fish formatDistanceToNowStrict, ro)', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms).toISOString(), now);
  it('takes the largest unit, rounded, with Romanian grammar', () => {
    expect(ago(1000)).toBe('acum 1 secundă');
    expect(ago(45_000)).toBe('acum 45 de secunde');
    expect(ago(5 * 60_000)).toBe('acum 5 minute');
    expect(ago(25 * 60_000)).toBe('acum 25 de minute');
    expect(ago(60 * 60_000)).toBe('acum 1 oră');
    expect(ago(3 * 3600_000)).toBe('acum 3 ore');
    expect(ago(2 * 86400_000)).toBe('acum 2 zile');
    expect(ago(65 * 86400_000)).toBe('acum 2 luni');
    expect(ago(800 * 86400_000)).toBe('acum 2 ani');
  });
});
