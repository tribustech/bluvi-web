import { formatCount } from '@/core/realtime/chat/format';

/*
 * The past polls' pure copy (parity participant.polls-past.c4). fish app/(app)/polls/past.tsx
 * formatClosedDate + the card's facts line. No React, no DOM: unit-tested in format.test.ts.
 */

export const PAST_POLLS_TITLE = 'Sondaje anterioare';

/** ro-RO long month names (fish toLocaleDateString('ro-RO', { month: 'long' })), hand-rolled. */
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

/** The calendar day in Romania (fish formats in the phone's zone — Romanian users, Romania's day). */
const PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric' });

/**
 * «1 iunie 2026» from closedAt, else closesAt (a poll closed by hand has no closesAt; one that ran
 * out has no closedAt); null when there is neither or the date is unreadable.
 */
export function closedDateLabel(poll: { closedAt?: string | null; closesAt: string | null }): string | null {
  const iso = poll.closedAt ?? poll.closesAt;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/** «12 voturi», «1 vot», «20 de voturi» (formatCount). */
export const votesLabel = (n: number) => formatCount(n, 'vot', 'voturi');

/**
 * The card's facts line (c4): «Închis · 1 iunie 2026 · 3 voturi». Without a date fish prints an
 * empty date slot («Închis · · 3 voturi»); the web drops the empty slot: «Închis · 3 voturi».
 */
export function pastPollFacts(poll: { closedAt?: string | null; closesAt: string | null; totalVotes: number }): string {
  const date = closedDateLabel(poll);
  return ['Închis', date, votesLabel(poll.totalVotes)].filter(Boolean).join(' · ');
}

/** The list footer's progress total: «23 de sondaje», «1 sondaj». */
export const pollsCount = (n: number) => formatCount(n, 'sondaj', 'sondaje');
