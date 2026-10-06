import { describe, expect, it } from 'vitest';
import type { CompetitionCard } from '@/core/competitions';
import { groupOf, PAST_GROUP, upcomingGroups } from './buckets';

// Wednesday 7 October 2026, 12:00 in Bucharest (UTC+3).
const NOW = new Date('2026-10-07T09:00:00.000Z');
/** A Bucharest wall-clock day at 08:00. */
const day = (d: string) => `${d}T05:00:00.000Z`;

describe('groupOf', () => {
  it.each([
    [day('2026-10-07'), 'today', 'Azi'],
    [day('2026-10-08'), 'tomorrow', 'Mâine'],
    [day('2026-10-09'), 'week', 'Săptămâna asta'],
    [day('2026-10-10'), 'weekend', 'Weekendul ăsta'],
    [day('2026-10-11'), 'weekend', 'Weekendul ăsta'],
    [day('2026-10-12'), 'nextWeek', 'Săptămâna viitoare'],
    [day('2026-10-18'), 'nextWeek', 'Săptămâna viitoare'],
    [day('2026-10-19'), 'm2026-9', 'Mai târziu în octombrie'],
    [day('2026-11-02'), 'm2026-10', 'Noiembrie'],
    [day('2027-01-10'), 'm2027-0', 'Ianuarie 2027'],
    [day('2026-10-06'), PAST_GROUP, 'Data de start a trecut'],
    [null, 'tbd', 'Fără dată'],
  ])('%s → %s', (iso, key, label) => {
    expect(groupOf(iso, NOW)).toMatchObject({ key, label });
  });

  it('days are Bucharest days: 23:30 UTC on the 7th is already the 8th', () => {
    expect(groupOf('2026-10-07T23:30:00.000Z', NOW).key).toBe('tomorrow');
  });

  it('on a Friday, Saturday is «Mâine» and Sunday the weekend', () => {
    const friday = new Date('2026-10-09T09:00:00.000Z');
    expect(groupOf(day('2026-10-10'), friday).key).toBe('tomorrow');
    expect(groupOf(day('2026-10-11'), friday).key).toBe('weekend');
  });
});

const card = (documentId: string, startDate: string | null) => ({ documentId, startDate }) as CompetitionCard;

describe('upcomingGroups', () => {
  it('orders the groups on the time axis, the passed starts last', () => {
    const groups = upcomingGroups(
      [card('past', day('2026-10-01')), card('later', day('2026-11-02')), card('tomorrow', day('2026-10-08')), card('today', day('2026-10-07'))],
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(['today', 'tomorrow', 'm2026-10', PAST_GROUP]);
  });

  it('inside a group: mine first, then by start time, ties in the CMS order', () => {
    const [g] = upcomingGroups(
      [card('b', day('2026-11-05')), card('a', day('2026-11-02')), card('mine', day('2026-11-20')), card('c', day('2026-11-02'))],
      NOW,
      new Set(['mine']),
    );
    expect(g.cards.map((c) => c.documentId)).toEqual(['mine', 'a', 'c', 'b']);
  });
});
