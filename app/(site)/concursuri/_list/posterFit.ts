/*
 * How a competition poster sits in its frame — one rule for the Concursuri tab's cards
 * (CompetitionCardItem) and the status lists' poster band (LegacyCompetitionCard).
 *
 * fish MIN_RATIO / MAX_RATIO: a frame never gets taller than 0.55 (it would fill the screen) nor
 * wider than 2.4 (an unreadable strip). Inside that clamp a photo FILLS its frame (cover); outside it,
 * or when the frame is fixed and the photo's shape is far from it (a portrait poster with a printed
 * fee or rules in a landscape band), it is shown WHOLE (contain, over a blurred copy of itself).
 */

export const MIN_RATIO = 0.55;
export const MAX_RATIO = 2.4;

/** The frame a poster of `ratio` (width / height) gets when the frame follows the poster. */
export const clampRatio = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

/**
 * A fixed band (the status lists' 16:10 / 120px band): `cover` while the photo's ratio is within
 * `tolerance` of the band's widest and narrowest shapes (`band` = [narrowest, widest] across the
 * widths the band takes), so an ordinary 3:2 / 4:3 / 16:9 landscape photo fills it and loses at most
 * a sliver; `contain` for anything else (portrait posters, panoramas, square logos) — shown whole.
 * Unknown ratio (not decoded yet): cover, the common case for lake photos.
 */
export function posterFit(ratio: number | null, band: readonly [number, number], tolerance = 0.2): 'cover' | 'contain' {
  if (ratio === null) return 'cover';
  const [lo, hi] = band;
  return ratio >= lo * (1 - tolerance) && ratio <= hi * (1 + tolerance) ? 'cover' : 'contain';
}
