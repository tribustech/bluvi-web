/*
 * Text/icon colour ON a sector fill. The sector tokens (globals.css --color-sector-a..x) are the
 * same in light and dark, so the ink cannot be the theme's `on-accent` (white in light, near-black
 * in dark): it is picked per hue by contrast instead. Light hues (E F J K O P W) take navy, which
 * is also constant across themes; the rest take white (on-photo-scrim, constant white).
 *
 * Kit gap: a `--color-sector-<x>-fg` token per sector would make this map unnecessary.
 */

const LIGHT_HUES = new Set(['E', 'F', 'J', 'K', 'O', 'P', 'W']);

export const INK_ON_LIGHT_HUE = 'text-navy';
export const INK_ON_DARK_HUE = 'text-on-photo-scrim';

/** Text colour class for content drawn on sector `name`'s fill (A–X; anything else is treated as dark). */
export function sectorInk(name: string): string {
  return LIGHT_HUES.has(name.trim().toUpperCase()) ? INK_ON_LIGHT_HUE : INK_ON_DARK_HUE;
}

/** Same, from a `bg-sector-x` class (action-bar tiles, view chips). Non-sector fills keep on-accent. */
export function inkForFill(fill: string): string {
  const match = /\bbg-sector-([a-x])\b/.exec(fill);
  return match ? sectorInk(match[1]) : 'text-on-accent';
}
