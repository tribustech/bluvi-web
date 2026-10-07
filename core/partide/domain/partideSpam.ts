// Ported from fish `features/partide/helpers/partideSpam.ts` (pure).
// Anti-spam windows + pure helpers for the partidă live surface.
//
//  - Rod outcomes (scăpat = 'lost', fără trăsătură = 'blank') share a HARD 60 s
//    cooldown per rod: you cannot drop a fish / register no-bite twice within a
//    minute on the same rod.
//  - Captură is SOFT-confirmed when the same rod-bucket logged a catch < 30 s ago.

import type { LocalEvent, Outcome } from './types';

/** Hard block window for repeat scăpat/fără-trăsătură on the same rod. */
export const COOLDOWN_MS = 60_000;
/** Soft-confirm window for a repeat captură in the same rod-bucket. */
export const CONFIRM_MS = 30_000;

/** Rod captures bucket on rodIndex; no-rod captures share the 'free' bucket. */
export type CaptureBucket = number | 'free';

type SpamEvent = Pick<LocalEvent, 'rodIndex' | 'outcome' | 'occurredAt'>;

/**
 * Most recent event of the SAME `outcome` on `rodIndex`, as ms elapsed at `now`.
 * Null = none. Per-outcome (independent windows): a `blank` never blocks a `lost`
 * and vice versa — only repeating the same action counts as spam.
 */
export function lastOutcomeAgeMs(events: SpamEvent[], rodIndex: number, outcome: Extract<Outcome, 'lost' | 'blank'>, now: number): number | null {
  let latest: number | null = null;
  for (const e of events) {
    if (e.rodIndex !== rodIndex) continue;
    if (e.outcome !== outcome) continue;
    if (latest == null || e.occurredAt > latest) latest = e.occurredAt;
  }
  return latest == null ? null : now - latest;
}

/** Most recent captură in `bucket`, as ms elapsed at `now`. Null = none. */
export function lastCaptureAgeMs(events: SpamEvent[], bucket: CaptureBucket, now: number): number | null {
  let latest: number | null = null;
  for (const e of events) {
    if (e.outcome !== 'capture') continue;
    const inBucket = bucket === 'free' ? e.rodIndex == null : e.rodIndex === bucket;
    if (!inBucket) continue;
    if (latest == null || e.occurredAt > latest) latest = e.occurredAt;
  }
  return latest == null ? null : now - latest;
}

/** Per-outcome, friendly blocked-cooldown copy (tone matches the success-flash jokes). */
export function cooldownMessage(outcome: Extract<Outcome, 'lost' | 'blank'>, secondsAgo: number): string {
  return outcome === 'lost'
    ? `Ai marcat deja «scăpat» pe lanseta asta acum ${secondsAgo}s. Un pește nu scapă de două ori într-un minut 🎣`
    : `Ai marcat deja «fără trăsătură» acum ${secondsAgo}s. Stai un pic până la următoarea aruncare 🎣`;
}
