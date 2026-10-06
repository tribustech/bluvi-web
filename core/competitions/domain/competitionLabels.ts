/*
 * The competition's descriptive labels — ported from fish helpers/getRankingType.ts,
 * helpers/getParticipationType.ts and common/helpers/getCompetitionDuration.ts (date-fns
 * differenceInHours / differenceInDays → whole elapsed hours / days).
 */

/** fish `getRankingType`: the «Tip clasament» label; '' for a type fish does not know. */
export function getRankingTypeLabel(competition: {
  rankingType: string;
  bestOfFishCount?: number | null;
  bestOfTierSizes?: readonly number[] | null;
}): string {
  switch (competition.rankingType) {
    case 'quality':
      return 'Calitate';
    case 'quantity':
      return 'Cantitate';
    case 'quantityQuality':
      return 'Cantitate/Calitate';
    case 'qualityQuantity':
      return 'Calitate/Cantitate';
    case 'bestOf':
      return `Best of ${competition.bestOfFishCount || ''}`;
    case 'nationalChampionship':
      return 'Campionat Național';
    case 'fipsed':
      return 'Campionat Mondial FIPSed';
    case 'calitateCalitate':
      return 'Calitate/Calitate';
    case 'calitateCantitateCMMC':
      return 'Cal/Cant/CMMC';
    case 'feederRounds':
      return 'Feeder';
    case 'bestOfTiers': {
      const tiers = competition.bestOfTierSizes;
      return Array.isArray(tiers) && tiers.length > 0 ? `Best of ${tiers.join(', ')}` : 'Best of x, y, z...';
    }
    default:
      return '';
  }
}

/**
 * fish `getParticipationType`: «Individual»; a team event spells its roster size only before the
 * start («Echipe de 3»), and a missing size degrades to «Echipe».
 */
export function getParticipationType(competition: {
  competitionType: string;
  competitionStatus: string;
  teamParticipants?: number | null;
}): string {
  if (competition.competitionType === 'single') return 'Individual';
  if (competition.competitionStatus !== 'notStarted') return 'Echipe';
  return competition.teamParticipants ? `Echipe de ${competition.teamParticipants}` : 'Echipe';
}

const HOUR = 3_600_000;

/** fish `getCompetitionDuration`: up to 72 h «N oră/ore», above «N zi/zile [și M oră/ore]». */
export function getCompetitionDuration(start: string, end: string): string {
  const totalHours = Math.trunc((new Date(end).getTime() - new Date(start).getTime()) / HOUR);
  if (totalHours <= 72) return `${totalHours} ${totalHours === 1 ? 'oră' : 'ore'}`;
  const days = Math.trunc(totalHours / 24);
  const remainingHours = totalHours - days * 24;
  const d = `${days} ${days === 1 ? 'zi' : 'zile'}`;
  return remainingHours === 0 ? d : `${d} și ${remainingHours} ${remainingHours === 1 ? 'oră' : 'ore'}`;
}
