// Ported from fish `features/partide/domain/rodPhase.ts` (pure).
import type { RodRuntime } from './types';

/**
 * The phase a rod is REALLY in, from its deadline and the clock in hand.
 *
 * `runtime.phase` is what a snapshot or a local reduce stamped at some earlier
 * instant, with whatever clock was current then. On a cold start that clock is
 * the device's (no server sample yet) and the snapshot is Firestore's offline
 * cache, so a rod could be frozen as `firing` («Expirat») for a deadline still
 * minutes away — and stay so until the next projection push (2026-09-22, in a
 * competition on bad signal). The deadline is absolute and server-stamped, so it
 * is the only thing worth trusting: `fishing` and `firing` are one state with
 * two faces, decided here against `now` on every read, in both directions.
 * A running rod with no deadline (a serialized local firing) stays `firing`.
 */
export function effectivePhase(runtime: RodRuntime, now: number): RodRuntime['phase'] {
  if (runtime.phase !== 'fishing' && runtime.phase !== 'firing') return runtime.phase;
  if (runtime.endEpoch == null) return 'firing';
  return runtime.endEpoch <= now ? 'firing' : 'fishing';
}

export function isRunningPhase(phase: RodRuntime['phase']): boolean {
  return phase === 'fishing' || phase === 'firing';
}
