import type { T2SheetSnap } from './context';

/** The phone sheet's rests as the height of sheet on screen (px), the strip under the tab bar included. */
export type Rest = Record<T2SheetSnap, number>;

/** How far ahead a release is projected (ms × px/ms): a flick carries the sheet to the next rest. */
const FLING_MS = 220;

/**
 * The rest a released sheet settles on (Airbnb / gorhom): the one nearest to where the movement
 * was heading — the visible height projected FLING_MS ahead at the release velocity.
 * `velocity` is the finger's in px/ms, positive downward (the sheet getting shorter).
 */
export function pickRest(visible: number, velocity: number, rests: Rest): T2SheetSnap {
  const projected = visible - velocity * FLING_MS;
  const order: T2SheetSnap[] = ['peek', 'half', 'full'];
  return order.reduce<T2SheetSnap>((best, k) => (Math.abs(rests[k] - projected) < Math.abs(rests[best] - projected) ? k : best), 'peek');
}
