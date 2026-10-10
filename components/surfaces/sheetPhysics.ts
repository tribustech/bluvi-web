/**
 * The phone sheet's release physics — the same model as the lakes map sheet (T2 `pickRest`, fish's
 * gorhom sheets): the release velocity is read over the finger's last 100 ms, the visible height is
 * projected FLING_MS ahead at that velocity, and the sheet settles on the rest nearest to where the
 * movement was heading. A dismissible sheet has one more rest, 0 — closed — so a quick flick down
 * closes it even from high up, while a slow drag only closes past half of its lowest rest.
 */

/** How far ahead a release is projected (ms × px/ms) — as T2 `sheet.ts`. */
export const FLING_MS = 220;
/** The window the release velocity is read over (ms). */
const VELOCITY_WINDOW_MS = 100;

export type Sample = { y: number; t: number };

/** The finger's velocity at release in px/ms, positive downward (the sheet getting shorter). */
export function releaseVelocity(samples: Sample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  const first = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? samples[0]!;
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

/**
 * Where a released sheet goes: the index of a rest (heights in px, any order), or 'close'.
 * `visible` is the height of sheet on screen at release.
 */
export function settle(visible: number, velocity: number, rests: number[], dismissible: boolean): number | 'close' {
  const projected = visible - velocity * FLING_MS;
  let best: number | 'close' = dismissible ? 'close' : 0;
  let bestDist = dismissible ? Math.abs(projected) : Infinity;
  rests.forEach((r, i) => {
    const d = Math.abs(r - projected);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** Past the ends a drag is damped (iOS rubber band): above the top rest, and below the lowest when it cannot close. */
export function rubberBand(visible: number, min: number, max: number): number {
  if (visible > max) return max + (visible - max) * 0.2;
  if (visible < min) return min - (min - visible) * 0.3;
  return visible;
}
