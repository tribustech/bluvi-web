/*
 * Feeder on legs («manșe», FIPS) — the ranking's pure view model. Ported from fish
 * features/competitions/feeder-rounds/feederRoundsTable.ts (tabs, empty-leg message, formatting)
 * and feederRankingModel.ts (General with one group per leg; a leg grouped by sector). The RN
 * column widths (feederColumns) and the image rows (feederRows) are layout, not ported.
 */
import type { FeederRoundsRanking } from '../schemas';
import { getCompetitorDisplayName } from './table/getCompetitorDisplayName';

export type FeederTab = 'general' | number;
export type FeederRoundStatus = 'running' | 'closed' | null | undefined;

const GENERAL_PODIUM = 3;

/** Sector and stand joined, as anglers say it: "A4", "C12". */
export const feederSeat = (sectorName: string | null | undefined, standName: string | null | undefined) =>
  sectorName && standName ? `${sectorName}${standName}` : '';

/** fish `weight`: three decimals, «-» when missing. */
export const feederWeight = (n: number | null | undefined) =>
  typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(3) : '-';

/** fish `points`: whole or halves (averaged ties); never more than one decimal. */
export const feederPoints = (n: number | null | undefined) => (typeof n === 'number' ? String(parseFloat(n.toFixed(1))) : '-');

/** fish `defaultFeederTab`: the leg in progress, otherwise General. */
export function defaultFeederTab(c: {
  competitionStatus?: string | null;
  currentRound?: number | null;
  roundStatus?: FeederRoundStatus;
}): FeederTab {
  if (c.competitionStatus === 'started' && c.roundStatus === 'running' && c.currentRound) return c.currentRound;
  return 'general';
}

/** fish `feederLegCount`: the legs present in the ranking (a leg joins with its first catch). */
export function feederLegCount(rankings: readonly FeederRoundsRanking[]): number {
  return rankings.reduce((max, r) => Math.max(max, r.rounds?.length ?? 0), 0);
}

/** fish `feederTabCount`: one tab per leg of the competition (roundsCount), started or not. */
export function feederTabCount(rankings: readonly FeederRoundsRanking[], roundsCount: number | null | undefined): number {
  return Math.max(roundsCount ?? 0, feederLegCount(rankings));
}

/**
 * fish `futureLegMessage`: what a leg tab says while it has nothing to show — the leg has not
 * started, or it has but nothing is weighed yet. Null once the leg is in the ranking, and on General.
 */
export function futureLegMessage(
  tab: FeederTab,
  currentRound: number | null | undefined,
  roundStatus: FeederRoundStatus,
  legsInRanking: number,
): { title: string; detail: string } | null {
  if (tab === 'general') return null;
  if (tab <= (currentRound ?? 0)) {
    if (tab <= legsInRanking) return null;
    return { title: `Manșa ${tab} a început`, detail: 'Clasamentul manșei apare după prima cântărire.' };
  }
  const title = `Manșa ${tab} nu a început încă`;
  if (tab === (currentRound ?? 0) + 1 && roundStatus === 'closed') {
    return { title, detail: 'Organizatorul reașază standurile după tragerea la sorți, apoi pornește manșa.' };
  }
  return { title, detail: `Începe după încheierea manșei ${tab - 1}.` };
}

/**
 * fish FeederHelpSheet `status` (CompetitionRanking.tsx): «manșa N este în desfășurare / este
 * încheiată» while the competition is not completed; null once it is (no «provizoriu» chip).
 */
export function feederProvisionalStatus(
  competitionStatus: string | null | undefined,
  currentRound: number | null | undefined,
  roundStatus: FeederRoundStatus,
): string | null {
  if (competitionStatus === 'completed' || currentRound == null) return null;
  return `manșa ${currentRound} ${roundStatus === 'closed' ? 'este încheiată' : 'este în desfășurare'}`;
}

/** fish `displayName`: team → every member (not only the first) → the single participant → guest → «-». */
export const feederDisplayName = (r: Pick<FeederRoundsRanking, 'teamName' | 'participants' | 'participant' | 'guestName'>) =>
  getCompetitorDisplayName({
    teamName: r.teamName,
    participantNames: r.participants?.length
      ? r.participants.map(p => p.username)
      : r.participant
        ? [r.participant.username]
        : [],
    guestName: r.guestName,
  });

export type FeederLegCell = { points: string; seat: string; kg: string };

export type FeederGeneralRow = {
  registrationId: string;
  /** The entrant's CURRENT stand: how a pressed row resolves to its registration. */
  standId: string | null;
  position: number;
  name: string;
  totalPoints: string;
  totalKg: string;
  podium: boolean;
  legs: FeederLegCell[];
};

export type FeederLegRow = {
  registrationId: string;
  standId: string | null;
  name: string;
  points: string;
  seat: string;
  kg: string;
  catchCount: string;
  biggestFish: string;
  sectorWinner: boolean;
};

export type FeederLegSection = {
  /** null = entrants who did not fish this leg. */
  sector: string | null;
  rows: FeederLegRow[];
};

const EMPTY_LEG: FeederLegCell = { points: '-', seat: '-', kg: '-' };
const standKey = (r: FeederRoundsRanking) => (r.standId == null ? null : String(r.standId));

/** fish `feederGeneralModel`: by generalPosition; podium = places 1–3 with fish; one cell per leg. */
export function feederGeneralModel(rankings: readonly FeederRoundsRanking[], legCount: number) {
  const legs = Array.from({ length: legCount }, (_, i) => i + 1);
  const rows: FeederGeneralRow[] = [...rankings]
    .sort((a, b) => a.generalPosition - b.generalPosition)
    .map(r => ({
      registrationId: r.registrationId,
      standId: standKey(r),
      position: r.generalPosition,
      name: feederDisplayName(r),
      totalPoints: feederPoints(r.totalPoints),
      totalKg: feederWeight(r.quantity),
      podium: r.quantity > 0 && r.generalPosition >= 1 && r.generalPosition <= GENERAL_PODIUM,
      legs: legs.map(leg => {
        const c = r.rounds.find(x => x.round === leg);
        if (!c || c.points == null) return EMPTY_LEG;
        return { points: feederPoints(c.points), seat: feederSeat(c.sectorName, c.standName) || '-', kg: feederWeight(c.quantity) };
      }),
    }));
  return { legs, rows };
}

const standOrder = (name: string | null | undefined) => {
  const n = parseInt(name ?? '', 10);
  return Number.isNaN(n) ? Infinity : n;
};

/**
 * fish `feederLegModel`: one section per sector (A→Z) plus «did not fish» last; inside a sector by
 * points, then kg desc, then stand number; the best-points entrant(s) with fish are sector winners.
 * The sector colour is the UI's (fish passes its palette in; the web maps the letter to its token).
 */
export function feederLegModel(rankings: readonly FeederRoundsRanking[], leg: number) {
  const bySector = new Map<string | null, { row: FeederLegRow; pts: number; kg: number; stand: number }[]>();
  for (const r of rankings) {
    const c = r.rounds.find(x => x.round === leg);
    // Seated in this leg (a sector and a stand); scored once the leg has points.
    const seated = !!c && !!c.sectorName && !!c.standName;
    const scored = seated && c!.points != null;
    const sector = seated ? c!.sectorName : null;
    const hasFish = scored && c!.quantity > 0;
    const entry = {
      pts: scored ? (c!.points as number) : Infinity,
      kg: scored ? c!.quantity : 0,
      stand: seated ? standOrder(c!.standName) : Infinity,
      row: {
        registrationId: r.registrationId,
        standId: standKey(r),
        name: feederDisplayName(r),
        points: scored ? feederPoints(c!.points) : '-',
        seat: seated ? feederSeat(c!.sectorName, c!.standName) || '-' : '-',
        kg: scored ? feederWeight(c!.quantity) : '-',
        catchCount: hasFish ? String(c!.catchCount) : '-',
        biggestFish: hasFish ? feederWeight(c!.biggestFish) : '-',
        sectorWinner: false,
      },
    };
    const list = bySector.get(sector) ?? [];
    list.push(entry);
    bySector.set(sector, list);
  }

  const sectors = [...bySector.keys()].sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
  const sections: FeederLegSection[] = sectors.map(sector => {
    const entries = bySector.get(sector)!.sort((a, b) => a.pts - b.pts || b.kg - a.kg || a.stand - b.stand);
    if (sector !== null) {
      const withFish = entries.filter(e => e.kg > 0);
      const best = Math.min(...withFish.map(e => e.pts));
      for (const e of withFish) if (e.pts === best) e.row.sectorWinner = true;
    }
    return { sector, rows: entries.map(e => e.row) };
  });
  return { sections };
}

/**
 * fish features/competitions/feeder-rounds/feederRoundActions.ts#currentLegOf — the leg to scope
 * stand-keyed reads to (`/feed/weighings/by-stand?round=`); undefined for every other type.
 */
export function currentLegOf(
  c: { rankingType?: string | null; currentRound?: number | null } | null | undefined
): number | undefined {
  return c?.rankingType === 'feederRounds' && c.currentRound != null ? c.currentRound : undefined;
}

/* ------------------------------------------------------------------ */
/* Leg actions — fish features/competitions/feeder-rounds/feederRoundActions.ts */
/* ------------------------------------------------------------------ */

/**
 * The leg state the CMS exposes on the competition detail. Mirrors fir-intins-cms
 * src/api/competition/services/feeder-rounds-lifecycle.ts — the server re-checks every action.
 */
export type FeederRoundState = {
  rankingType?: string | null;
  competitionStatus?: string | null;
  roundsCount?: number | null;
  currentRound?: number | null;
  roundStatus?: string | null;
};

export type FeederRoundAction = {
  kind: 'closeRound' | 'allocateNext' | 'startNext' | 'end';
  label: string;
  round?: number;
  confirmation?: string;
};

/**
 * fish `feederRoundActions`: the organizer actions of a feeder-on-legs competition («manșe»).
 *
 *   leg n running, not last → Închide manșa n
 *   leg n closed            → Reașază pentru manșa n+1, Pornește manșa n+1
 *   last leg running        → Încheie concursul (the existing end endpoint)
 *
 * Before the start, the existing «Start concurs» starts leg 1. Null for every other competition.
 */
export function feederRoundActions(c: FeederRoundState | null | undefined): FeederRoundAction[] | null {
  if (!c || c.rankingType !== 'feederRounds' || c.competitionStatus !== 'started') return null;
  const current = c.currentRound ?? 1;
  const isLast = current >= (c.roundsCount ?? 0);

  if (c.roundStatus === 'closed') {
    const next = current + 1;
    return [
      { kind: 'allocateNext', round: next, label: `Reașază pentru manșa ${next}` },
      {
        kind: 'startNext',
        round: next,
        label: `Pornește manșa ${next}`,
        confirmation: `Pornești manșa ${next}? Standurile trase sunt salvate?`,
      },
    ];
  }
  if (isLast) {
    return [{ kind: 'end', label: 'Încheie concurs', confirmation: 'Ești sigur că vrei să închei competiția?' }];
  }
  return [
    {
      kind: 'closeRound',
      round: current,
      label: `Închide manșa ${current}`,
      confirmation: `Închizi manșa ${current}? Cântarele ei nu mai pot fi redeschise.`,
    },
  ];
}

/**
 * fish feederRoundsTable.ts#previousLegSeats: registration documentId → «M{n-1}: sector/stand», the
 * seat each entrant had in the previous leg (shown while the organizer re-seats for leg `round`).
 */
export function previousLegSeats(rankings: readonly FeederRoundsRanking[], round: number): Record<string, string> {
  const prev = round - 1;
  const out: Record<string, string> = {};
  for (const r of rankings) {
    const c = r.rounds?.find(x => x.round === prev);
    if (c?.sectorName && c.standName) out[r.registrationId] = `M${prev}: ${c.sectorName}/${c.standName}`;
  }
  return out;
}
