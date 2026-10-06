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

/**
 * fish helpers/formatNationalStand.ts — «A3(12)»: the sector's letter + the draw position, the stand
 * in brackets (national championship); without a draw position the plain «A12».
 */
export function nationalStandLabel(sectorName: string | null | undefined, drawPosition: number | null | undefined, standName: string): string {
  const s = (sectorName ?? '').trim();
  const letter = s.length <= 1 ? s : (s.match(/[A-Za-z]\s*$/)?.[0]?.trim() ?? s[s.length - 1] ?? '');
  return drawPosition != null ? `${letter}${drawPosition}(${standName})` : `${letter}${standName}`;
}

/**
 * The national ranking types (club rankings: nationalChampionship and fipsed): their stands are
 * named «A3(12)» (sector letter + draw position, the stand in brackets) everywhere on the page.
 */
export function isNationalType(rankingType: string | null | undefined): boolean {
  return rankingType === 'nationalChampionship' || rankingType === 'fipsed';
}
