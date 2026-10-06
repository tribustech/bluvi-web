/*
 * National Championship / FIPSed ranking (one row per club, its teams nested) — the pure parts of
 * fish components/competition/NationalChampionshipRanking.tsx (sector rows, sorts),
 * components/ranking-table/NationalChampionshipTable.tsx (the club table rows), and the helpers
 * helpers/formatNationalStand.ts and helpers/computeSectorRankingMetadata.ts.
 */
import type { NationalChampionshipStandRanking, RankingResponse } from '../schemas';

type NcTeam = NationalChampionshipStandRanking['teams'][number];

/** fish `sectorLetter`: the trailing letter of a sector name («Sector A» → «A»). */
const sectorLetter = (sectorName: string | null | undefined): string => {
  const s = (sectorName ?? '').trim();
  if (s.length <= 1) return s;
  const tail = s.match(/[A-Za-z]\s*$/);
  return tail?.[0]?.trim() ?? s[s.length - 1] ?? s[0] ?? '';
};

/** fish `formatNationalStand`: «A3(12)» with a draw position, else «A12». */
export const formatNationalStand = (
  sectorName: string | null | undefined,
  sectorDrawPosition: number | null | undefined,
  standName: string | number | null | undefined,
): string => {
  const letter = sectorLetter(sectorName);
  const stand = standName == null ? '' : String(standName);
  return sectorDrawPosition != null ? `${letter}${sectorDrawPosition}(${stand})` : `${letter}${stand}`;
};

/** fish `isNationalChampionshipRankings`: the club-shaped rankings (nationalChampionship / fipsed). */
export function isNationalChampionshipRankings(
  rankings: RankingResponse['rankings'] | undefined | null,
): rankings is NationalChampionshipStandRanking[] {
  return !!rankings && rankings.length > 0 && 'clubId' in (rankings[0] as object);
}

/** fish `team.participants → usernames joined`, else guest name, else team name (club table). */
export function ncTeamParticipants(team: Pick<NcTeam, 'participants' | 'guestName' | 'teamName'>): string {
  const names = team.participants?.map(p => p.username).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : team.guestName || team.teamName || '';
}

/** fish: winners are the places 1..numberOfSectors (clubs by clubPosition, teams by generalPosition). */
export function isNcWinner(numberOfSectors: number | null | undefined, position: number | null | undefined): boolean {
  if (!numberOfSectors || position == null) return false;
  return position >= 1 && position <= numberOfSectors;
}

export type NcGeneralSort = 'club' | 'position';
export type NcSectorSort = 'stand' | 'position';

/**
 * fish `sortedGeneralRankings`: Club = the backend order; Poziția în clasament = clubs by
 * clubPosition (teams keep the backend's sector order).
 */
export function sortNcClubs(rankings: readonly NationalChampionshipStandRanking[], sortBy: NcGeneralSort): NationalChampionshipStandRanking[] {
  if (sortBy !== 'position') return [...rankings];
  return [...rankings].sort((a, b) => (a.clubPosition ?? Infinity) - (b.clubPosition ?? Infinity));
}

/** fish `formatSectorPosition`: integers as is, otherwise one decimal. */
export const ncPlace = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export type NcSectorRow = {
  registrationId: string | null;
  standId: string;
  sectorName: string;
  /** «A3(12)» / «A12». */
  stand: string;
  club: string;
  participants: string;
  /** Three decimals, «-» for a capot team. */
  quantity: string;
  averageWeight: string;
  biggestFish: string;
  catchCount: number;
  sectorPoints: string;
  sectorPosition: string;
  generalPosition: number;
  sectorDrawPosition: number | null;
  capot: boolean;
};

/**
 * fish `sectorRows` for one sector (by sector documentId): the teams fished there, with their club;
 * position = capot last, then generalPosition; stand = draw position (or, without draw positions,
 * the sector position with capot last).
 */
export function ncSectorRows(rankings: readonly NationalChampionshipStandRanking[], sectorId: string, sortBy: NcSectorSort): NcSectorRow[] {
  const rows: NcSectorRow[] = [];
  for (const club of rankings) {
    for (const team of club.teams) {
      if (team.sectorId !== sectorId) continue;
      const usernames = team.participants?.map(p => p.username).filter(Boolean) ?? [];
      const capot = team.catchCount === 0;
      rows.push({
        registrationId: team.registrationId ?? null,
        standId: String(team.standId),
        sectorName: team.sectorName,
        stand: formatNationalStand(team.sectorName, team.sectorDrawPosition, team.standName),
        club: club.clubName || '-',
        participants: usernames.length > 0 ? usernames.join(', ') : team.teamName || team.guestName || '-',
        quantity: team.catchCount > 0 ? team.quantity.toFixed(3) : '-',
        averageWeight: team.catchCount > 0 ? (team.quantity / team.catchCount).toFixed(3) : '-',
        biggestFish: team.biggestFish > 0 ? team.biggestFish.toFixed(3) : '-',
        catchCount: team.catchCount,
        sectorPoints: ncPlace(team.sectorPoints),
        sectorPosition: ncPlace(team.sectorPosition),
        generalPosition: team.generalPosition,
        sectorDrawPosition: team.sectorDrawPosition ?? null,
        capot,
      });
    }
  }
  const capotLast = (a: NcSectorRow, b: NcSectorRow) => (a.capot === b.capot ? 0 : a.capot ? 1 : -1);
  if (sortBy === 'position') {
    rows.sort((a, b) => capotLast(a, b) || a.generalPosition - b.generalPosition);
  } else if (rows.some(r => r.sectorDrawPosition != null)) {
    rows.sort((a, b) => (a.sectorDrawPosition ?? Infinity) - (b.sectorDrawPosition ?? Infinity));
  } else {
    rows.sort((a, b) => capotLast(a, b) || Number(a.sectorPosition) - Number(b.sectorPosition));
  }
  return rows;
}

/** fish club palette: six colours by club order (`colors[index % 6]`). The UI maps the index to its tokens. */
export const NC_CLUB_PALETTE_SIZE = 6;

export type NcGeneralTeam = {
  registrationId: string | null;
  standId: string;
  participants: string;
  stand: string;
  /** Cantitate Sector: three decimals, «-» for zero. */
  quantity: string;
  sectorPoints: string;
  generalPosition: number;
  /** generalPosition ≤ numberOfSectors: the Loc Individual cell is highlighted with 🎖️. */
  individualWinner: boolean;
};

export type NcGeneralClub = {
  clubId: string;
  clubName: string;
  /** Index into the 6-colour club palette (fish: by club order in the shown list). */
  colorIndex: number;
  /** clubPosition ≤ numberOfSectors. */
  winner: boolean;
  totalKg: string;
  biggestCatch: string;
  catchCount: string;
  averageWeight: string;
  points: string;
  position: string;
  teams: NcGeneralTeam[];
};

const kg3 = (n: number | null | undefined) => (typeof n === 'number' && n !== 0 ? n.toFixed(3) : '-');
const plain = (n: number | null | undefined) => (typeof n === 'number' && n !== 0 ? String(n) : '-');

/** fish NationalChampionshipTable rows: one club, its teams (merged club columns). */
export function ncGeneralModel(rankings: readonly NationalChampionshipStandRanking[], numberOfSectors: number | null | undefined): NcGeneralClub[] {
  return rankings.map((club, index) => ({
    clubId: club.clubId,
    clubName: club.clubName || '-',
    colorIndex: index % NC_CLUB_PALETTE_SIZE,
    winner: isNcWinner(numberOfSectors, club.clubPosition),
    totalKg: kg3(club.clubTotalQuantity),
    biggestCatch: kg3(club.clubBiggestCatch),
    catchCount: plain(club.clubTotalCatchCount),
    averageWeight: kg3(club.clubAverageWeight),
    points: plain(club.clubPoints),
    position: plain(club.clubPosition),
    teams: club.teams.map(team => ({
      registrationId: team.registrationId ?? null,
      standId: String(team.standId),
      participants: ncTeamParticipants(team) || '-',
      stand: formatNationalStand(team.sectorName, team.sectorDrawPosition, team.standName),
      quantity: kg3(team.quantity),
      sectorPoints: plain(team.sectorPoints),
      generalPosition: team.generalPosition,
      individualWinner: isNcWinner(numberOfSectors, team.generalPosition),
    })),
  }));
}

/**
 * fish `computeSectorRankingMetadata`: one sector's own totals (the image of a sector table
 * recomputes them from that sector's teams).
 */
export function ncSectorTotals(rankings: readonly NationalChampionshipStandRanking[], sectorId: string) {
  const teams = rankings.flatMap(c => c.teams).filter(t => t.sectorId === sectorId);
  return {
    totalQuantity: Number(teams.reduce((sum, t) => sum + (t.quantity || 0), 0).toFixed(3)),
    totalCatchesCount: teams.reduce((sum, t) => sum + (t.catchCount || 0), 0),
    biggestFish: teams.reduce((max, t) => Math.max(max, t.biggestFish || 0), 0),
  };
}
