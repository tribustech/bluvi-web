/**
 * fish `features/partide/hooks/useNowTick.ts` — ONE shared clock for every «acum 8m» / «de pescuit»
 * label of the Partide pages (parity partide.comunitate.c22). However many cards subscribe there is
 * exactly one interval: it starts with the first subscriber and stops with the last, so a page with
 * no clock consumer runs no timer. React binds it with useSyncExternalStore (the server snapshot is
 * null: relative times only exist in the browser, so the static HTML never carries a stale «acum»).
 */

/** fish NOW_TICK_INTERVAL_MS: the cadence of every relative label across Partide. */
export const NOW_TICK_INTERVAL_MS = 30_000;

export interface NowTickStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
  /** Subscribers right now (tests). */
  size(): number;
}

export function createNowTickStore(
  clock: () => number = () => Date.now(),
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void } = {
    set: (fn, ms) => setInterval(fn, ms),
    clear: id => clearInterval(id as ReturnType<typeof setInterval>),
  },
): NowTickStore {
  let current = clock();
  let id: unknown = null;
  const listeners = new Set<() => void>();
  const tick = () => {
    current = clock();
    listeners.forEach(l => l());
  };
  return {
    subscribe(listener) {
      // Only a restart from zero refreshes the value (fish: refreshing on every subscribe would make
      // each new card re-render once and leave its siblings on an older value).
      if (listeners.size === 0) {
        current = clock();
        id = timers.set(tick, NOW_TICK_INTERVAL_MS);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && id != null) {
          timers.clear(id);
          id = null;
        }
      };
    },
    getSnapshot() {
      // fish self-heal: idle (no timer) and older than one tick → refresh, so the first paint after
      // an idle gap is not stale. Mutating here keeps repeated reads within a render identical.
      if (listeners.size === 0 && clock() - current >= NOW_TICK_INTERVAL_MS) current = clock();
      return current;
    },
    size: () => listeners.size,
  };
}
