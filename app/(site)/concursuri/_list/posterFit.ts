/*
 * How a competition poster sits in the poster card's frame (./cards/PosterCard).
 *
 * fish MIN_RATIO / MAX_RATIO: on the phone the frame follows the poster but never gets taller than
 * 0.55 (it would fill the screen) nor wider than 2.4 (an unreadable strip). Inside that clamp the
 * photo FILLS its frame (cover, which crops nothing — the frame is its shape); outside it, the
 * photo is shown WHOLE (contain) over its own blurhash.
 *
 * From 768 the frame is a square (owner, 2026-10-06), so a row of cards keeps one height: a (near)
 * square poster fills it, anything else is shown whole over its blurhash bands.
 */

export const MIN_RATIO = 0.55;
export const MAX_RATIO = 2.4;
/** «Near square»: within 20% of 1:1 the poster fills the desktop square. */
const SQUARE_TOLERANCE = 0.2;

/** The phone frame a poster of `ratio` (width / height) gets. */
export const clampRatio = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

export type PosterFrame = {
  /** The phone frame's aspect ratio (width / height). */
  phoneRatio: number;
  /** Phone: the poster is shown whole over its bands (its ratio is outside the clamp). */
  phoneContain: boolean;
  /** ≥768: the poster is shown whole over its bands in the square (not near square). */
  squareContain: boolean;
};

/**
 * The frame for a poster whose ratio is `ratio`, or null while it is unknown (no pixel size in the
 * DTO and not decoded yet): a 4:3 frame the photo covers — the common lake photo — on the phone,
 * and the square shown whole (contain) from 768, so nothing is cropped before the shape is known.
 */
export function posterFrame(ratio: number | null): PosterFrame {
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return { phoneRatio: 4 / 3, phoneContain: false, squareContain: true };
  const phoneRatio = clampRatio(ratio);
  return {
    phoneRatio,
    phoneContain: phoneRatio !== ratio,
    squareContain: ratio < 1 - SQUARE_TOLERANCE || ratio > 1 + SQUARE_TOLERANCE,
  };
}
