// Ported from fish `features/partide/helpers/baitHistory.ts` (pure).
import type { BaitValue } from './captureSave';
import type { LocalEvent, LocalSession } from './types';

/** Normalized identity for deduping history entries — mirrors the stats grouping key. */
const keyOf = (bait: string) => bait.trim().toLowerCase();

/**
 * Distinct baits the angler actually used, newest first — sourced from every session's rod
 * configs (recency = session start) and every capture event carrying a bait (recency = capture
 * time). Picking one applies the FULL BaitValue (name + taxonomy), so re-using a bait keeps the
 * statistics grouping consistent instead of spawning near-duplicate entries.
 */
export function computeBaitHistory(
  sessions: Pick<LocalSession, 'startedAt' | 'rods'>[],
  events: Pick<LocalEvent, 'outcome' | 'occurredAt' | 'bait' | 'baitType' | 'baitSize' | 'baitFlavor'>[],
  limit = 8,
): BaitValue[] {
  const best = new Map<string, { at: number; value: BaitValue }>();

  const consider = (at: number, value: BaitValue) => {
    const name = value.bait?.trim();
    if (!name) return;
    const key = keyOf(name);
    const prev = best.get(key);
    if (prev && prev.at >= at) return;
    best.set(key, { at, value: { ...value, bait: name } });
  };

  for (const s of sessions) {
    for (const rod of s.rods ?? []) {
      consider(s.startedAt, { bait: rod.bait ?? '', baitType: rod.baitType ?? null, baitSize: rod.baitSize ?? null, baitFlavor: rod.baitFlavor ?? null });
    }
  }

  for (const e of events) {
    if (e.outcome !== 'capture') continue;
    consider(e.occurredAt, { bait: e.bait ?? '', baitType: e.baitType ?? null, baitSize: e.baitSize ?? null, baitFlavor: e.baitFlavor ?? null });
  }

  return [...best.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(x => x.value);
}
