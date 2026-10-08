/**
 * fish app/(app)/raffle/status.tsx:15-26 `useCountdown`: the whole days, hours and minutes left
 * until the session's end, floored, never negative (a past end reads 0 / 0 / 0). fish computes it
 * once per render and does not tick (participant.raffle-status.c3); the web keeps that: the page
 * passes the time it was rendered at.
 */
import { formatCount, pluralNoun } from '@/core/realtime/chat/format';

export type CountdownParts = { days: number; hours: number; minutes: number };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function countdownParts(end: Date | null, now: number): CountdownParts {
  if (!end || Number.isNaN(end.getTime())) return { days: 0, hours: 0, minutes: 0 };
  const diff = Math.max(0, end.getTime() - now);
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
  };
}

/** The countdown tile shows only before the end and with an end date (fish: `!isEnded && countdownEnd`). */
export function showCountdown(state: { isEnded: boolean; countdownEnd: Date | null }): boolean {
  return !state.isEnded && state.countdownEnd !== null;
}

/**
 * c3: the unit under each figure agrees with it (owner rule: correct plurals). fish prints the fixed
 * «Zile / Ore / Minute» (raffleCopy.ts:147-149), so «1 Zile»; the web says «1 Zi», «2 Zile».
 */
const UNITS = {
  days: ['Zi', 'Zile'],
  hours: ['Oră', 'Ore'],
  minutes: ['Minut', 'Minute'],
} as const satisfies Record<keyof CountdownParts, readonly [string, string]>;

export type CountdownCell = { id: keyof CountdownParts; value: number; label: string; spoken: string };

/**
 * The three cells: the figure, its label (the noun alone, pluralNoun) and the phrase a screen
 * reader hears (formatCount, lowercase: «1 zi», «2 ore», «20 de minute»).
 */
export function countdownCells(parts: CountdownParts): CountdownCell[] {
  return (Object.keys(UNITS) as (keyof CountdownParts)[]).map((id) => {
    const [one, many] = UNITS[id];
    const value = parts[id];
    return { id, value, label: pluralNoun(value, one, many), spoken: formatCount(value, one.toLowerCase(), many.toLowerCase()) };
  });
}
