/*
 * Sector colors for the ranking. The ranking tables use fish's fills under text (ROADMAP §4b.15:
 * 40% cells, 90% winner rows, the solid band); elsewhere a sector colour is the 4px edge and the dot.
 *
 * The row builders (core/competitions/domain/table) take a `sectorColors` map and copy the value
 * onto `row.backgroundColor`. On the web we hand them CSS variables of the sector tokens
 * (globals.css --color-sector-a..x), so the color stays theme-driven.
 */

export const SECTOR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('');

/**
 * Literal class names (Tailwind only emits a theme variable when a class uses it, so the 24
 * sector colors must appear as classes somewhere — here). Used for the stripe and the dot.
 */
const SECTOR_BG: Record<string, string> = {
  A: 'bg-sector-a', B: 'bg-sector-b', C: 'bg-sector-c', D: 'bg-sector-d', E: 'bg-sector-e', F: 'bg-sector-f',
  G: 'bg-sector-g', H: 'bg-sector-h', I: 'bg-sector-i', J: 'bg-sector-j', K: 'bg-sector-k', L: 'bg-sector-l',
  M: 'bg-sector-m', N: 'bg-sector-n', O: 'bg-sector-o', P: 'bg-sector-p', Q: 'bg-sector-q', R: 'bg-sector-r',
  S: 'bg-sector-s', T: 'bg-sector-t', U: 'bg-sector-u', V: 'bg-sector-v', W: 'bg-sector-w', X: 'bg-sector-x',
};

/**
 * Background for a sector stripe/dot: the token class when the sector is A–X, otherwise the
 * color the row builder carried (`row.backgroundColor`) as an inline style.
 */
export function sectorFill(sectorName: string, fallback: string): { className: string; style?: { background: string } } {
  const cls = SECTOR_BG[sectorName.trim().toUpperCase()];
  return cls ? { className: cls } : { className: '', style: { background: fallback } };
}

/** "A" → "var(--color-sector-a)"; unknown names fall back to the muted ink. */
export function sectorColor(sectorName: string): string {
  const letter = sectorName.trim().toUpperCase();
  return SECTOR_LETTERS.includes(letter) ? `var(--color-sector-${letter.toLowerCase()})` : 'var(--color-muted)';
}

/** The `sectorColors` argument for createXRow(): every sector A–X mapped to its token. */
export function sectorColorMap(): Record<string, string> {
  return Object.fromEntries(SECTOR_LETTERS.map(l => [l, sectorColor(l)]));
}

/** The builders' `position` is "A/7" (sectorName/standName). */
export function parseStand(position: string): { sector: string; stand: string } {
  const slash = position.indexOf('/');
  if (slash === -1) return { sector: '', stand: position };
  return { sector: position.slice(0, slash), stand: position.slice(slash + 1) };
}

/*
 * Text on a sector fill (ROADMAP §4b.15, fish's colour language with AA): fish writes white on the
 * 90% winner row and the solid band; the web keeps white where it clears 4.5:1 and writes black
 * (fish's own cell ink) where it does not. Computed for every sector (globals.css, ranking tokens):
 * the lowest pair is 4.6:1.
 */
const WHITE_ON_SOLID = new Set('ADGHILMNQRTUVX'.split(''));
const WHITE_ON_WIN = new Set('DGHINQRTUX'.split(''));

/** The text class on a sector's solid band (`solid`) or its 90% winner fill (`win`). */
export function sectorInk(sectorName: string, fill: 'solid' | 'win'): 'text-rank-on-dark' | 'text-rank-on-light' {
  const letter = sectorName.trim().toUpperCase();
  const white = fill === 'solid' ? WHITE_ON_SOLID.has(letter) : WHITE_ON_WIN.has(letter);
  return white ? 'text-rank-on-dark' : 'text-rank-on-light';
}

/** The CSS variable a row / band sets for the rank-sector-* fills (globals.css). */
export function sectorVar(sectorName: string, fallback?: string): { '--sector': string } {
  const letter = sectorName.trim().toUpperCase();
  return { '--sector': SECTOR_LETTERS.includes(letter) ? `var(--color-sector-${letter.toLowerCase()})` : (fallback ?? 'var(--color-rank-no-sector)') };
}
