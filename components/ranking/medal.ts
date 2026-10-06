/*
 * Podium medals — fish rankColor (gold, silver, bronze) as kit tokens (globals.css --bluvi-medal-*):
 * theme-invariant, each carrying the navy digit (6.7 / 5.7 / 4.9:1). One map for every podium step,
 * top-three rank chip and cup on the site (a lake's / a public water's Clasament and Statistici,
 * the competition cards' cups).
 */

export type MedalPlace = 1 | 2 | 3;

export const isMedalPlace = (position: number): position is MedalPlace => position === 1 || position === 2 || position === 3;

/** A filled medal surface with its digit: podium steps, rank chips. */
export const MEDAL: Record<MedalPlace, string> = {
  1: 'bg-medal-gold text-on-medal',
  2: 'bg-medal-silver text-on-medal',
  3: 'bg-medal-bronze text-on-medal',
};

/** The medal as a glyph colour (currentColor artwork: the cup). */
export const MEDAL_TEXT: Record<MedalPlace, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
};
