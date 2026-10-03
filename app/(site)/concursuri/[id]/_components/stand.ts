/**
 * Stand label for the web: sector letter + stand number («A7»). Some stands are named with their
 * sector already («A7» in sector A); those are not prefixed twice.
 */
export function standLabel(sector: string, stand: string): string {
  const s = sector.trim();
  const st = stand.trim();
  return s && !st.toUpperCase().startsWith(s.toUpperCase()) ? `${s}${st}` : st;
}

/**
 * fish CompetitionRanking `formatStand` (= the CMS catches `standKey`): the sector's letter + the
 * stand name, verbatim. Used where the value goes back to the API as a filter.
 */
export function formatStand(sectorName: string, standName: string): string {
  const s = (sectorName ?? '').trim();
  const letter = s.length <= 1 ? s : ((s.match(/[A-Za-z]\s*$/) ?? [])[0]?.trim() ?? s[s.length - 1] ?? s[0] ?? '');
  return `${letter}${standName ?? ''}`;
}
