import { feederProvisionalStatus, type CompetitionWithMyStatus } from '@/core/competitions';
import { canWeighCompetition, isAuthorOrReferee, type CompetitionRole } from '../../_organizer/access';

type HintCompetition = Pick<CompetitionWithMyStatus, 'competitionStatus' | 'rankingType' | 'currentRound' | 'roundStatus'>;

/**
 * The scale header's meta line — only what is known (rule 4): the leg on a feeder competition, then
 * what the viewer can do here once the statute is read. Nothing while the role is unknown.
 * A closed leg never promises weighing: its weighings cannot be reopened and the scale opens again
 * when the next leg starts (feederRoundActions).
 */
export function scaleHint(competition: HintCompetition, role: CompetitionRole | undefined): string | null {
  const feeder = competition.rankingType === 'feederRounds';
  const round = feeder ? competition.currentRound : null;
  const closedLeg = feeder && competition.roundStatus === 'closed' && round != null && competition.competitionStatus === 'started';
  if (closedLeg && isAuthorOrReferee(role)) {
    return `Manșa ${round} este încheiată: cântarul se redeschide la pornirea manșei ${round + 1}.`;
  }
  const parts: string[] = [];
  const leg = feederProvisionalStatus(competition.competitionStatus, round, competition.roundStatus);
  if (leg) parts.push(leg.charAt(0).toUpperCase() + leg.slice(1));
  if (competition.competitionStatus === 'completed') parts.push('Concursul s-a încheiat: cântăririle se pot doar vedea.');
  else if (canWeighCompetition(role, competition)) parts.push('Alege standul pe care îl cântărești.');
  else if (isAuthorOrReferee(role) && competition.competitionStatus === 'notStarted') parts.push('Cântarul se deschide la startul concursului.');
  else if (role !== undefined) parts.push('Alege un stand ca să vezi cântăririle lui.');
  return parts.length ? parts.join(' · ') : null;
}
