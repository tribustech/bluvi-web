/**
 * fish `features/partide/helpers/feedbackNudge.ts` — when a live partidă is allowed to ask for
 * feedback.
 *
 * One ask per partidă: each trip is its own thing to have an opinion about, and the angler who
 * fishes every weekend is exactly the one worth hearing from. The record is a list of already-asked
 * session ids, so leaving and re-entering the same partidă does not bring the bar back.
 *
 * Plain functions (no hooks, no storage) so the rules are testable on their own — the storage read
 * lives with the app (fish `useFeedbackNudge`; web `_member/FeedbackBar`).
 */

/** Storage key of the asked-partide list (fish ASYNC_STORAGE_KEYS.PARTIDA_FEEDBACK_NUDGE_SESSIONS_V1). */
export const NUDGE_STORAGE_KEY = 'bluvi.partide.feedbackNudgeSessions.v1';

/** Enough of a partidă has happened to have an opinion about it. */
export const NUDGE_MIN_CAPTURES = 3;
export const NUDGE_MIN_ELAPSED_MS = 4 * 60 * 60 * 1000; // 4h

/**
 * How many asked-partidă ids are kept. Only exists to stop the list growing forever — the worst
 * case of forgetting is one extra ask on a partidă left open for weeks.
 */
export const NUDGE_HISTORY_LIMIT = 50;

/**
 * How long the "o găsești în Info" hint stays up after the bar is dismissed. The bar itself has no
 * timeout — it covers nothing, so it waits for an answer instead of vanishing mid-read.
 */
export const NUDGE_HINT_MS = 3_500;

/** The partidă is far enough along that asking is fair. */
export function nudgeThresholdMet({ captures, elapsedMs }: { captures: number; elapsedMs: number }): boolean {
  return captures >= NUDGE_MIN_CAPTURES || elapsedMs >= NUDGE_MIN_ELAPSED_MS;
}

/**
 * Parse the stored id list defensively — a hand-edited or half-written value must degrade to
 * "nobody was asked yet" rather than take the bar down for good.
 */
export function parseNudgedSessions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  } catch {
    return [];
  }
}

/** This partidă has already had its one ask. */
export function wasNudged(sessionIds: string[], sessionClientId: string): boolean {
  return sessionIds.includes(sessionClientId);
}

/** Append the partidă, newest last, trimmed to the history limit. */
export function rememberNudged(sessionIds: string[], sessionClientId: string): string[] {
  const next = sessionIds.filter(id => id !== sessionClientId);
  next.push(sessionClientId);
  return next.slice(-NUDGE_HISTORY_LIMIT);
}
