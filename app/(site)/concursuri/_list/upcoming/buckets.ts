import type { CompetitionCard } from '@/core/competitions';
import { dayParts, MONTHS_FULL } from '../desktop/dates';

/*
 * Viitoare's time groups (prototype app/dev/hub Upcoming.tsx: Azi · Mâine · Weekendul ăsta · Mai
 * târziu), on the Bucharest calendar. «Mai târziu» is split so a long list stays readable: the rest
 * of this week, next week, then by month. A start day already gone (still «not started») is LAST,
 * muted (the agenda's «Data de start a trecut»). Pure: no React, no Next.
 */

export const PAST_GROUP = 'past';

export type UpcomingGroup = { key: string; label: string; cards: CompetitionCard[] };

/** The group a start date falls in, and its place in the page. */
export function groupOf(startIso: string | null, now: Date): { key: string; label: string; order: number } {
  if (!startIso) return { key: 'tbd', label: 'Fără dată', order: 9e9 };
  const d = dayParts(startIso);
  const today = dayParts(now);
  if (d.index < today.index) return { key: PAST_GROUP, label: 'Data de start a trecut', order: 1e10 };
  if (d.index === today.index) return { key: 'today', label: 'Azi', order: 0 };
  if (d.index === today.index + 1) return { key: 'tomorrow', label: 'Mâine', order: 1 };
  // Weeks run Monday to Sunday.
  const weekStart = today.index - ((today.weekday + 6) % 7);
  if (d.index < weekStart + 7) {
    const weekend = d.weekday === 6 || d.weekday === 0;
    return weekend ? { key: 'weekend', label: 'Weekendul ăsta', order: 3 } : { key: 'week', label: 'Săptămâna asta', order: 2 };
  }
  if (d.index < weekStart + 14) return { key: 'nextWeek', label: 'Săptămâna viitoare', order: 4 };
  const month = MONTHS_FULL[d.month];
  const label =
    d.year === today.year && d.month === today.month
      ? `Mai târziu în ${month.toLowerCase()}`
      : d.year === today.year
        ? month
        : `${month} ${d.year}`;
  return { key: `m${d.year}-${d.month}`, label, order: 5 + d.year * 12 + d.month };
}

/**
 * The tab's cards in their groups. Inside a group the order is stable: the viewer's own
 * registrations first, then by start time (ties keep the CMS order).
 */
export function upcomingGroups(cards: CompetitionCard[], now: Date, mine: ReadonlySet<string> = new Set()): UpcomingGroup[] {
  const groups = new Map<string, UpcomingGroup & { order: number }>();
  for (const c of cards) {
    const g = groupOf(c.startDate, now);
    const group = groups.get(g.key) ?? { key: g.key, label: g.label, order: g.order, cards: [] };
    group.cards.push(c);
    groups.set(g.key, group);
  }
  const time = (c: CompetitionCard) => (c.startDate ? Date.parse(c.startDate) : Number.POSITIVE_INFINITY);
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, cards: list }) => ({
      key,
      label,
      cards: list
        .map((c, i) => ({ c, i }))
        .sort((a, b) => Number(mine.has(b.c.documentId)) - Number(mine.has(a.c.documentId)) || time(a.c) - time(b.c) || a.i - b.i)
        .map(({ c }) => c),
    }));
}
