import { feederProvisionalStatus, type CompetitionDetail, type CompetitionWithMyStatus } from '@/core/competitions';
import { formatStandLabel, type AllocatedParticipantsResponse, type WeighingByStand } from '@/core/organizer';
import { formatDecimal } from '@/components/cards/format';
import { shortDateTime } from '../../../_components/dates';
import { canWeighCompetition, isAuthorOrReferee, type CompetitionRole } from '../../../_organizer/access';

/*
 * The stand history's model (parity organizer.scale-history; fish app/(app)/scale/[competitionId]/
 * history.tsx + components/scale/CantarItem.tsx). Pure: the page renders what these return.
 *
 * fish reads the sector and stand names from the route's query string (?sector=&stand=); the web
 * route carries the stand's id only, so both come from the competition's own sectors — a stand that
 * is not in them is `null` (the page says so, never a «Sector undefined»).
 */

const NC = 'nationalChampionship';

export type StandHeader = {
  standId: string;
  sectorName: string;
  standName: string;
  /** fish formatStandLabel: «Sector A, Stand 3» / NC «Stand A1(10)». */
  label: string;
  /** NC only: the registration's club (the operator's anchor at a weigh-in). */
  club: string | null;
  /** «Echipa <nume>» when the registration has a team name. */
  team: string | null;
  /** The bullets: the guest's name, or the participants'. */
  people: string[];
};

/** c2 — the header card's content, from the competition's sectors and the stand's allocation. */
export function standHeader(
  competition: Pick<CompetitionDetail, 'sectors' | 'rankingType'>,
  allocations: AllocatedParticipantsResponse | null | undefined,
  standId: string,
): StandHeader | null {
  for (const sector of competition.sectors) {
    const stand = sector.stands.find((s) => s.documentId === standId);
    if (!stand) continue;
    const isNc = competition.rankingType === NC;
    const alloc = allocations?.[standId] ?? null;
    return {
      standId,
      sectorName: sector.name,
      standName: stand.name,
      label: formatStandLabel(isNc, sector.name, alloc?.sectorDrawPosition ?? null, stand.name),
      club: isNc && alloc?.clubName ? alloc.clubName : null,
      team: alloc?.teamName ? `Echipa ${alloc.teamName}` : null,
      people: alloc ? (alloc.guestName ? [alloc.guestName] : alloc.participants.map((p) => p.name)) : [],
    };
  }
  return null;
}

export type WeighingRow = {
  id: string;
  /** fish «Cântar {index + 1}»: the position in the stand's list. */
  number: number;
  /** «Cântar 2» / «Cântar 2 (Extra)». */
  title: string;
  extra: boolean;
  finished: boolean;
  catches: number;
  /** Sum of the catches, kg. */
  totalKg: number;
  /** fish `dd.MM, HH:mm` in Bucharest («27.09, 07:42»); '' when the CMS has no start. */
  start: string;
  /** The end, or «În curs» while it has none. */
  end: string;
  open: boolean;
};

/** c4 — one card / row per weighing, in the CMS's order (fish FlatList). */
export function weighingRows(weighings: WeighingByStand[] | undefined): WeighingRow[] {
  return (weighings ?? []).map((w, index) => {
    const extra = w.weighingType === 'extra';
    const number = index + 1;
    return {
      id: w.documentId,
      number,
      title: `Cântar ${number}${extra ? ' (Extra)' : ''}`,
      extra,
      finished: w.weighingStatus === 'finished',
      catches: w.catches.length,
      totalKg: w.catches.reduce((acc, c) => acc + c.weight, 0),
      start: w.startDate ? shortDateTime(w.startDate) : '',
      end: w.endDate ? shortDateTime(w.endDate) : 'În curs',
      open: !w.endDate,
    };
  });
}

/** fish CantarItem `toFixed(3)` with the Romanian decimal comma: «12,450». */
export const formatWeighingKg = (kg: number) => formatDecimal(kg, 3, 3);

/** The header's total (fish getWeightingsTotal's «37.350» string) as a number; null when unusable. */
export function parseTotal(total: string | undefined): number | null {
  if (total == null) return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

/** c7 — fish CantarItem canDeleteCantar: no catches, not finished, and actions allowed. */
export const canDeleteWeighing = (row: Pick<WeighingRow, 'catches' | 'finished'>, actionsAllowed: boolean) =>
  actionsAllowed && row.catches === 0 && !row.finished;

/**
 * ≥1280: the weighing the side panel opens on — the one in progress (what the referee is doing),
 * else the latest. A selection that no longer exists (deleted, another leg) falls back the same way.
 */
export function defaultSelection(rows: WeighingRow[], selected: string | null): string | null {
  if (selected && rows.some((r) => r.id === selected)) return selected;
  const open = [...rows].reverse().find((r) => !r.finished);
  return open?.id ?? rows.at(-1)?.id ?? null;
}

/** The stand's figures for the summary card: weighings, catches and kg over the list. */
export function standTotals(rows: WeighingRow[]) {
  return {
    weighings: rows.length,
    extra: rows.filter((r) => r.extra).length,
    catches: rows.reduce((n, r) => n + r.catches, 0),
    open: rows.filter((r) => !r.finished).length,
  };
}

type HintCompetition = Pick<CompetitionWithMyStatus, 'competitionStatus' | 'rankingType' | 'currentRound' | 'roundStatus'>;

/**
 * The header's meta line — only what is known (rule 4): the feeder leg the list covers (c3), then
 * what the viewer can do here once the statute is read (c6). Nothing while the role is unknown.
 */
export function historyHint(competition: HintCompetition, role: CompetitionRole | undefined): string | null {
  const feeder = competition.rankingType === 'feederRounds';
  const round = feeder ? competition.currentRound : null;
  const parts: string[] = [];
  const leg = feederProvisionalStatus(competition.competitionStatus, round, competition.roundStatus);
  if (leg) parts.push(leg.charAt(0).toUpperCase() + leg.slice(1));
  if (competition.competitionStatus === 'completed') parts.push('Concursul s-a încheiat: cântăririle se pot doar vedea.');
  else if (canWeighCompetition(role, competition)) parts.push('Pornește un cântar nou sau deschide unul existent.');
  else if (isAuthorOrReferee(role) && competition.competitionStatus === 'notStarted') parts.push('Cântarul se deschide la startul concursului.');
  else if (isAuthorOrReferee(role) && feeder && competition.roundStatus === 'closed' && round != null)
    parts.push(`Cântarul se redeschide la pornirea manșei ${round + 1}.`);
  else if (role !== undefined) parts.push('Doar organizatorul și arbitrii pot cântări.');
  return parts.length ? parts.join(' · ') : null;
}
