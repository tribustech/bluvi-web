import {
  feederGeneralModel,
  feederLegCount,
  feederLegModel,
  feederTabCount,
  futureLegMessage,
  getRankingTypeLabel,
  isNationalChampionshipRankings,
  ncGeneralModel,
  ncSectorRows,
  ncSectorTotals,
  sortNcClubs,
  type ColumnDefinition,
  type FeederGeneralRow,
  type FeederLegSection,
  type FeederRoundsRanking,
  type NcGeneralClub,
  type RankingResponse,
} from '@/core/competitions';
import type { RankingRowData } from '@/components/ranking/model';
import { buildRankingTable, isTableRankingType } from '../../_components/ranking';

/*
 * The ranking image's content — fish app/(app)/competitions/ranking-image.tsx +
 * ranking-image-cn.tsx + RankingTableForScreenshot.tsx, as pure functions (parity
 * competition-page.imagine-clasament).
 *
 * fish hands the table to the image screen through in-memory state (atoms.ts rankingDataAtom /
 * nationalChampionshipRankingDataAtom) and clears it on leave. The web rebuilds the same table from
 * the URL instead (c10), so the link is shareable and survives a reload:
 *  - `sortare`: the order the reader had (standard: stand | loc; National Championship General:
 *    club | loc; one NC sector: stand | loc);
 *  - `sector`: a National Championship sector («A»), the sector's own table (fish
 *    selectedSectorView);
 *  - `mansa`: a feeder leg (1, 2 …) or `general` (fish feederTab).
 * Defaults are what the competition page opens on, and are left out of the URL.
 */

/** The URL's view of the table. */
export type ImageQuery = {
  sort: 'stand' | 'loc' | 'club' | null;
  sector: string | null;
  leg: 'general' | number;
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const v = source[key];
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/** Reads `sortare` / `sector` / `mansa`; anything unknown falls back to the default. */
export function parseImageQuery(source: ParamSource): ImageQuery {
  const sortRaw = read(source, 'sortare');
  const sort = sortRaw === 'stand' || sortRaw === 'loc' || sortRaw === 'club' ? sortRaw : null;
  const sectorRaw = read(source, 'sector')?.trim() ?? '';
  const sector = /^[A-Za-z]{1,2}$/.test(sectorRaw) ? sectorRaw.toUpperCase() : null;
  const legRaw = read(source, 'mansa');
  const legNum = legRaw && /^\d{1,2}$/.test(legRaw) ? Number(legRaw) : NaN;
  return { sort, sector, leg: legNum >= 1 ? legNum : 'general' };
}

/** The query string of a view («?sortare=loc&sector=B»), '' for the defaults. */
export function imageQueryString(q: Partial<ImageQuery>): string {
  const p = new URLSearchParams();
  if (q.sort) p.set('sortare', q.sort);
  if (q.sector) p.set('sector', q.sector);
  if (q.leg != null && q.leg !== 'general') p.set('mansa', String(q.leg));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const isNcType = (rankingType: string | undefined) => rankingType === 'nationalChampionship' || rankingType === 'fipsed';

/**
 * The view the image actually draws, from the competition alone (its ranking type and sectors):
 * a sector that does not exist is dropped (the club table, as buildRankingImage draws), the order
 * is reduced to what the ranking type uses (standard stand | loc, NC General place | club, an NC
 * sector place | stand), the leg only on feeder rankings. The page names, links and canonicalises
 * this query — never the raw URL — so «?sector=Z» or «?sortare=club» on a standard ranking cannot
 * label the band or mint a duplicate canonical. (A feeder leg past the last one is only known from
 * the ranking: buildRankingImage answers `noSuchView` for it.)
 */
export function effectiveImageQuery(competition: Pick<ImageCompetition, 'rankingType' | 'sectors'>, q: ImageQuery): ImageQuery {
  if (competition.rankingType === 'feederRounds') return { sort: null, sector: null, leg: q.leg };
  if (isNcType(competition.rankingType)) {
    const sector = q.sector && competition.sectors.some(s => s.name.trim().toUpperCase() === q.sector) ? q.sector : null;
    const sort = sector ? (q.sort === 'stand' ? 'stand' : null) : q.sort === 'club' ? 'club' : null;
    return { sort, sector, leg: 'general' };
  }
  return { sort: q.sort === 'loc' ? 'loc' : null, sector: null, leg: 'general' };
}

/** What the image shows, in words (the band's line under the title); `short` for the phone's narrow column. */
export function viewLabel(rankingType: string, q: ImageQuery): { full: string; short: string } {
  if (rankingType === 'feederRounds') {
    const label = q.leg === 'general' ? 'Clasament general' : `Manșa ${q.leg}`;
    return { full: label, short: label };
  }
  if (isNcType(rankingType)) {
    const label = q.sector ? `Sector ${q.sector}` : 'Clasament pe cluburi';
    return { full: label, short: label };
  }
  return q.sort === 'loc' ? { full: 'Clasament complet, după poziție', short: 'După poziție' } : { full: 'Clasament complet, după stand', short: 'După stand' };
}

/** The competition fields the image prints (the detail read, `/feed/competitions/:id`). */
export type ImageCompetition = {
  documentId: string;
  name: string;
  rankingType: string;
  competitionStatus: string;
  competitionType: string;
  startDate: string;
  endDate: string;
  bestOfFishCount?: number | null;
  bestOfTierSizes?: readonly number[] | null;
  author: { username: string } | null;
  lake: { name: string } | null;
  sectors: ReadonlyArray<{ documentId: string; name: string }>;
  sponsors: ReadonlyArray<{ documentId: string; name: string; image: { url: string } | null }>;
};

/** A column of the generic table, with fish's image sizing (RankingTableForScreenshot). */
export type ImageColumn = ColumnDefinition & {
  /** fish `dynamicWidth`: the longest value decides, within [min, max]. */
  dynamic?: { min: number; max: number };
};

/** A generic table row: the builders' row, its sector letter and whether its sector tint applies. */
export type ImageRow = RankingRowData & { sectorLetter: string };

export type ImageTable =
  | { kind: 'table'; columns: ImageColumn[]; rows: ImageRow[] }
  | { kind: 'ncGeneral'; clubs: NcGeneralClub[] }
  | { kind: 'feederGeneral'; legs: number[]; rows: FeederGeneralRow[]; nameTitle: string }
  | { kind: 'feederLeg'; sections: FeederLegSection[]; nameTitle: string };

export type ImageStats = { totalQuantity: number; totalCatchesCount: number; biggestFish: number };

export type RankingImageModel = {
  competition: ImageCompetition;
  /** The ranking-type badge (fish getRankingType). */
  rankingLabel: string;
  /** fish `sectorTitle`: «Sector B» (NC sector), «General» / «Manșa 2» (feeder); null otherwise. */
  title: { text: string; sectorLetter: string | null } | null;
  table: ImageTable;
  stats: ImageStats;
  /** fish handleShareImages `fileName` (no extension). */
  fileName: string;
  /** National Championship General: fish ranking-image-cn (its own file name and analytics events). */
  nc: boolean;
};

/**
 * Why there is nothing to draw: the competition has not started; the chosen table has no weighing
 * yet; the chosen table does not exist (a feeder leg past the last one); a ranking type the image
 * cannot draw.
 */
export type EmptyReason = 'notStarted' | 'noWeighing' | 'noSuchView' | 'unsupported';
export const EMPTY_REASONS: readonly EmptyReason[] = ['notStarted', 'noWeighing', 'noSuchView', 'unsupported'];

export type ImageBuild = { ok: true; model: RankingImageModel } | { ok: false; reason: EmptyReason };

/** fish getStatusText. */
export function statusText(status: string): string {
  switch (status) {
    case 'notStarted':
      return 'Neînceput';
    case 'started':
      return 'În desfășurare';
    case 'completed':
      return 'Finalizat';
    default:
      return status;
  }
}

/** fish NationalChampionshipRanking sectorColumns (the sector image goes through the generic table). */
const NC_SECTOR_COLUMNS: ImageColumn[] = [
  { key: 'position', title: 'Stand', dynamic: { min: 80, max: 160 } },
  { key: 'club', title: 'Club', dynamic: { min: 100, max: 200 } },
  { key: 'participant', title: 'Pescari', dynamic: { min: 120, max: 300 } },
  { key: 'quantity', title: 'Kg' },
  { key: 'averageWeight', title: 'Medie' },
  { key: 'biggestFish', title: 'CMMC' },
  { key: 'catchCount', title: 'Nr. Buc' },
  { key: 'sectorPoints', title: 'Puncte sector' },
  { key: 'sectorPlace', title: 'Loc sector' },
];

const sectorOfPosition = (position: string) => {
  const slash = position.indexOf('/');
  return slash === -1 ? '' : position.slice(0, slash);
};

/** fish `Clasament_{name}`, without characters a file name cannot hold. */
const fileSafe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * fish handleVeziFull (CompetitionRanking / NationalChampionshipRanking) + the image screens: the
 * table, its title and the totals under it, for the view the URL names. `empty` when fish would
 * have the button disabled (no rows, no numberOfSectors, an empty feeder leg); `unsupported` for a
 * ranking type it cannot draw.
 */
export function buildRankingImage(competition: ImageCompetition, data: RankingResponse | null | undefined, q: ImageQuery): ImageBuild {
  if (competition.competitionStatus === 'notStarted') return { ok: false, reason: 'notStarted' };
  const metadata = data?.metadata;
  if (!data || !metadata || !metadata.numberOfSectors || data.rankings.length === 0) return { ok: false, reason: 'noWeighing' };
  const base = {
    competition,
    rankingLabel: getRankingTypeLabel(competition),
    stats: {
      totalQuantity: metadata.totalQuantity,
      totalCatchesCount: metadata.totalCatchesCount,
      biggestFish: metadata.biggestFish,
    },
    fileName: `Clasament_${fileSafe(competition.name)}`,
    nc: false,
  };
  const nameTitle = competition.competitionType === 'team' ? 'Echipă' : 'Participant';

  if (metadata.rankingType === 'feederRounds') {
    const rankings = data.rankings as FeederRoundsRanking[];
    const legCount = feederLegCount(rankings);
    if (q.leg === 'general') {
      const { legs, rows } = feederGeneralModel(rankings, legCount);
      return { ok: true, model: { ...base, title: { text: 'General', sectorLetter: null }, table: { kind: 'feederGeneral', legs, rows, nameTitle } } };
    }
    // A leg past the competition's last one does not exist; fish feederLegEmpty (futureLegMessage):
    // a leg that has not started or has nothing weighed yet.
    if (q.leg > feederTabCount(rankings, metadata.roundsCount)) return { ok: false, reason: 'noSuchView' };
    if (futureLegMessage(q.leg, metadata.currentRound, metadata.roundStatus, legCount)) return { ok: false, reason: 'noWeighing' };
    const { sections } = feederLegModel(rankings, q.leg);
    return { ok: true, model: { ...base, title: { text: `Manșa ${q.leg}`, sectorLetter: null }, table: { kind: 'feederLeg', sections, nameTitle } } };
  }

  if (isNationalChampionshipRankings(data.rankings)) {
    const rankings = data.rankings;
    const sector = q.sector ? competition.sectors.find(s => s.name.trim().toUpperCase() === q.sector) : null;
    if (!sector) {
      // ranking-image-cn: the club table, clubs by place (default) or in the backend's order (Club).
      const clubs = ncGeneralModel(sortNcClubs(rankings, q.sort === 'club' ? 'club' : 'position'), metadata.numberOfSectors);
      return {
        ok: true,
        model: {
          ...base,
          title: null,
          table: { kind: 'ncGeneral', clubs },
          fileName: `Clasament_Campionat_National_${fileSafe(competition.name)}`,
          nc: true,
        },
      };
    }
    const sectorRows = ncSectorRows(rankings, sector.documentId, q.sort === 'stand' ? 'stand' : 'position');
    if (sectorRows.length === 0) return { ok: false, reason: 'noWeighing' };
    const letter = sector.name.trim().toUpperCase();
    const rows: ImageRow[] = sectorRows.map(r => ({
      position: r.stand,
      participant: r.participants,
      club: r.club,
      quantity: r.quantity,
      averageWeight: r.averageWeight,
      biggestFish: r.biggestFish,
      catchCount: r.catchCount,
      sectorPoints: r.sectorPoints,
      // «1,5» for averaged ties: text, so not the builders' numeric sectorPosition.
      sectorPlace: r.sectorPosition,
      generalPosition: r.generalPosition,
      // fish's sector rows carry no winner flag: every row is the light sector tint.
      isWinner: false,
      backgroundColor: letter,
      sectorLetter: letter,
    }));
    return {
      ok: true,
      model: {
        ...base,
        // fish computeSectorRankingMetadata: the totals are the sector's own.
        stats: ncSectorTotals(rankings, sector.documentId),
        title: { text: `Sector ${sector.name}`, sectorLetter: letter },
        table: { kind: 'table', columns: NC_SECTOR_COLUMNS, rows },
      },
    };
  }

  const built = buildRankingTable(data, q.sort === 'loc' ? 'position' : 'stand');
  if (!built) return isTableRankingType(metadata.rankingType) ? { ok: false, reason: 'noWeighing' } : { ok: false, reason: 'unsupported' };
  const columns: ImageColumn[] = built.columns.map(c => ({ ...c }));
  const rows: ImageRow[] = built.rows.map(r => ({ ...r, sectorLetter: sectorOfPosition(r.position).toUpperCase() }));
  return { ok: true, model: { ...base, title: null, table: { kind: 'table', columns, rows } } };
}

/** The view the competition page is on, as the image's query (the dialog's «Imagine clasament» link). */
export function imageQueryFor(view: {
  rankingType: string | undefined;
  sortBy: 'stand' | 'position';
  feederTab: 'general' | number;
  ncSectorName: string | null;
  ncSort: 'club' | 'stand' | 'position';
}): Partial<ImageQuery> {
  if (view.rankingType === 'feederRounds') return { leg: view.feederTab };
  if (isNcType(view.rankingType)) {
    const sector = view.ncSectorName?.trim().toUpperCase() ?? null;
    // Defaults: General by place, a sector by place.
    const sort = view.ncSort === 'position' ? null : view.ncSort === 'club' ? (sector ? null : 'club') : sector ? 'stand' : null;
    return { sector, sort };
  }
  return { sort: view.sortBy === 'position' ? 'loc' : null };
}

/** fish ranking-image: «{total|0} Kg», «{count|0}», «{avg 2 decimals|0} Kg», «{biggest|-} Kg». */
export function statLines(stats: ImageStats): [string, string][] {
  const avg = stats.totalQuantity && stats.totalCatchesCount ? (stats.totalQuantity / stats.totalCatchesCount).toFixed(2) : '0';
  return [
    ['Cantitate totală', `${stats.totalQuantity || 0} Kg`],
    ['Număr de pești', `${stats.totalCatchesCount || 0}`],
    ['Medie pești', `${avg} Kg`],
    ['Cea mai mare captură', `${stats.biggestFish || '-'} Kg`],
  ];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The image in words, for screen readers (the stage's aria-describedby): what the table is, how many
 * rows it has, the podium, and the totals under it (c5) — the ranking must not exist as pixels only.
 */
export function imageSummary(model: RankingImageModel, view: string): string {
  const t = model.table;
  const podium: string[] = [];
  let count: string;
  switch (t.kind) {
    case 'table': {
      count = plural(t.rows.length, 'rând', 'rânduri');
      for (const r of [...t.rows].filter(r => r.generalPosition >= 1 && r.generalPosition <= 3).sort((a, b) => a.generalPosition - b.generalPosition)) {
        podium.push(`locul ${r.generalPosition}: ${r.participant || '-'}`);
      }
      break;
    }
    case 'ncGeneral':
      count = plural(t.clubs.length, 'club', 'cluburi');
      for (const c of t.clubs.filter(c => ['1', '2', '3'].includes(c.position)).sort((a, b) => Number(a.position) - Number(b.position))) {
        podium.push(`locul ${c.position}: ${c.clubName}, ${c.points} puncte`);
      }
      break;
    case 'feederGeneral':
      count = plural(t.rows.length, 'rând', 'rânduri');
      for (const r of t.rows.filter(r => r.position >= 1 && r.position <= 3)) podium.push(`locul ${r.position}: ${r.name}, ${r.totalPoints} puncte`);
      break;
    case 'feederLeg': {
      const rows = t.sections.reduce((n, s) => n + s.rows.length, 0);
      count = `${plural(rows, 'rând', 'rânduri')} în ${plural(t.sections.filter(s => s.sector).length, 'sector', 'sectoare')}`;
      for (const s of t.sections) {
        const winner = s.rows.find(r => r.sectorWinner);
        if (s.sector && winner) podium.push(`Sector ${s.sector}: ${winner.name}, ${winner.points} puncte`);
      }
      break;
    }
  }
  const totals = statLines(model.stats)
    .map(([label, value]) => `${label} ${value}`)
    .join(', ');
  return [`${view}, ${model.rankingLabel}: ${count}.`, podium.length ? `${podium.join('; ')}.` : '', `${totals}.`].filter(Boolean).join(' ');
}
