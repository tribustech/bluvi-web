import {
  createBaseRow,
  createBestOfRow,
  createBestOfTiersRow,
  createCalitateCalitateRow,
  createQualityQuantityCMMCRow,
  createQualityQuantityRow,
  createQualityRow,
  createQuantityRow,
  getBestOfColumns,
  getBestOfTiersColumns,
  getCalitateCalitateColumns,
  getQualityColumns,
  getQualityQuantityCMMCColumns,
  getQualityQuantityColumns,
  getQuantityColumns,
  type BaseStandRanking,
  type BestOfStandRanking,
  type BestOfTiersStandRanking,
  type CalitateCalitateStandRanking,
  isNationalChampionshipRankings,
  type ColumnDefinition,
  type QualityQuantityCMMCStandRanking,
  type QualityQuantityStandRanking,
  type QualityStandRanking,
  type QuantityStandRanking,
  type RankingResponse,
} from '@/core/competitions';
import { cellNumber, paletteLetter, sectorColorMap, type RankingRowData } from '@/components/ranking';
import { toWebColumns } from '@/components/ranking/columns';
import { EMPTY_STAND } from '@/components/ranking/rankingColumns';
import { formatDecimal } from '@/components/cards/format';

/*
 * The ranking table of fish `components/competition/CompetitionRanking.tsx` (sortedRankings,
 * tableColumns, tableRows), as pure functions. Columns and rows come from the core builders
 * (core/competitions/domain/table); this file only decides WHICH builder and the order.
 */

/** fish `RankingBarSortBy` minus `club` (national championship only). */
export type RankingSort = 'stand' | 'position';

/** Ranking types the shared table renders. nationalChampionship / fipsed have their own club view in fish. */
const TABLE_TYPES = new Set([
  'quantity',
  'quality',
  'quantityQuality',
  'qualityQuantity',
  'bestOf',
  'bestOfTiers',
  'calitateCalitate',
  'calitateCantitateCMMC',
]);

export function isTableRankingType(rankingType: string | undefined): boolean {
  return !!rankingType && TABLE_TYPES.has(rankingType);
}

/**
 * fish `sortedRankings` (General tab): by place, or by sector then stand number. fish sorts the
 * query data in place; here a copy is sorted.
 */
export function sortStandRankings<T extends Pick<BaseStandRanking, 'sectorName' | 'standName' | 'generalPosition'>>(
  rankings: readonly T[],
  sortBy: RankingSort,
): T[] {
  const copy = [...rankings];
  if (sortBy === 'position') return copy.sort((a, b) => Number(a.generalPosition) - Number(b.generalPosition));
  return copy.sort((a, b) => {
    const sectorComparison = a.sectorName.localeCompare(b.sectorName);
    if (sectorComparison === 0) return Number(a.standName) - Number(b.standName);
    return sectorComparison;
  });
}

export type RankingTableData = { columns: ColumnDefinition[]; rows: RankingRowData[] };

/** bestOfTiers: catch columns grow with the data, capped at the biggest tier. */
function tiersCatchColumns(rankings: readonly BaseStandRanking[], tiers: readonly number[]): number {
  const maxTier = tiers.length > 0 ? Math.max(...tiers) : 0;
  const maxCatchesInData = rankings.reduce((max, r) => Math.max(max, (r as BestOfTiersStandRanking).catchCount ?? 0), 0);
  return Math.min(maxCatchesInData, maxTier);
}

/** fish `tableColumns` + `tableRows`. Null when there is nothing to show («Nu există date de afișat»). */
export function buildRankingTable(data: RankingResponse | undefined, sortBy: RankingSort): RankingTableData | null {
  const metadata = data?.metadata;
  if (!data || !metadata || !isTableRankingType(metadata.rankingType)) return null;

  const rankings = sortStandRankings(data.rankings as BaseStandRanking[], sortBy);
  if (!rankings.length) return null;

  // fish getColorsBySector: the palette by the sorted sector names present in the ranking (B and C
  // alone are palette[0] and palette[1]; a sector named «1» is coloured too) — parity clasament.c17.
  const sectorColors = sectorColorMap(rankings.map(r => r.sectorName));
  // Catch columns for quality-type rankings: the largest sectorMinNumberOfFish of all rows.
  const nrOfCatchesColumns = Math.max(...rankings.map(r => (r as QualityStandRanking).sectorMinNumberOfFish));

  let columns: ColumnDefinition[];
  switch (metadata.rankingType) {
    case 'quantity':
      columns = getQuantityColumns();
      break;
    case 'quality':
      columns = getQualityColumns(nrOfCatchesColumns);
      break;
    case 'quantityQuality':
    case 'qualityQuantity':
      columns = getQualityQuantityColumns(nrOfCatchesColumns);
      break;
    case 'bestOf':
      columns = getBestOfColumns(metadata.maxBestOfFishCount || 3, metadata.numberOfSectors);
      break;
    case 'bestOfTiers':
      columns = getBestOfTiersColumns(tiersCatchColumns(rankings, metadata.bestOfTierSizes ?? []), metadata.bestOfTierSizes ?? []);
      break;
    case 'calitateCalitate':
      columns = getCalitateCalitateColumns(nrOfCatchesColumns);
      break;
    case 'calitateCantitateCMMC':
      columns = getQualityQuantityCMMCColumns(nrOfCatchesColumns);
      break;
    default:
      return null;
  }

  // Winners, per ranking type: bestOf → numberOfWinners, bestOfTiers → one per tier,
  // otherwise the sector winners (numberOfSectors).
  const winnerCount =
    metadata.rankingType === 'bestOf'
      ? metadata.numberOfWinners
      : metadata.rankingType === 'bestOfTiers'
        ? (metadata.bestOfTierSizes?.length ?? 0)
        : metadata.numberOfSectors;
  const biggestStandId = metadata.biggestCatch?.standId ?? null;
  const biggestWeight = metadata.biggestCatch?.weight ?? null;

  const rows = rankings.map((ranking): RankingRowData => {
    const context = {
      isWinner: winnerCount ? ranking.generalPosition >= 1 && ranking.generalPosition <= winnerCount : false,
      biggestStandId,
      biggestWeight,
    };
    switch (metadata.rankingType) {
      case 'quantity':
        return createQuantityRow(ranking as QuantityStandRanking, sectorColors, context);
      case 'quality':
        return createQualityRow(ranking as QualityStandRanking, nrOfCatchesColumns, sectorColors, context);
      case 'quantityQuality':
      case 'qualityQuantity':
        return createQualityQuantityRow(ranking as QualityQuantityStandRanking, nrOfCatchesColumns, sectorColors, context);
      case 'bestOf':
        return createBestOfRow(ranking as BestOfStandRanking, metadata.bestOfFishCount, sectorColors, context);
      case 'bestOfTiers': {
        const tiers = metadata.bestOfTierSizes ?? [];
        return createBestOfTiersRow(
          ranking as BestOfTiersStandRanking,
          tiersCatchColumns(rankings, tiers),
          sectorColors,
          context,
          tiers,
        );
      }
      case 'calitateCalitate':
        return createCalitateCalitateRow(ranking as CalitateCalitateStandRanking, nrOfCatchesColumns, sectorColors, context);
      case 'calitateCantitateCMMC':
        return createQualityQuantityCMMCRow(
          ranking as QualityQuantityCMMCStandRanking,
          nrOfCatchesColumns,
          sectorColors,
          context,
        );
      default:
        return createBaseRow(ranking, sectorColors, context);
    }
  });

  return { columns, rows: rows.map(row => withNamedEmptyStand(withPlainStand(row))) };
}

/**
 * The name a stand without an angler gets. The builders print «-» (a bare hyphen read as a
 * rendering bug on its own line, and the page's «no value» mark is the en dash); the kit row and
 * table print `participant` as is, so it is named here. Other code compares against it rather than
 * treating it as a person (the weighing tile, the search).
 */
export { EMPTY_STAND };

function withNamedEmptyStand<T extends Pick<RankingRowData, 'participant'>>(row: T): T {
  const name = (row.participant ?? '').trim();
  return name === '' || name === '-' || name === '–' ? { ...row, participant: EMPTY_STAND } : row;
}

/**
 * Some stands are named with their sector already («A1» in sector A): the row's `position` then
 * reads "A/A1" and anything that prints sector + stand shows «AA1». Strip the repeated letter so
 * `position` is always "sector/number" (the kit RankingTable prints `{sector}{stand}` as is).
 */
export function withPlainStand<T extends Pick<RankingRowData, 'position'>>(row: T): T {
  const slash = row.position.indexOf('/');
  if (slash <= 0) return row;
  const sector = row.position.slice(0, slash);
  const stand = row.position.slice(slash + 1);
  if (stand.length <= sector.length || !stand.toUpperCase().startsWith(sector.toUpperCase())) return row;
  return { ...row, position: `${sector}/${stand.slice(sector.length)}` };
}

/** Sector name of a built row ("A/7" → "A"). */
export function rowSector(row: Pick<RankingRowData, 'position'>): string {
  const slash = row.position.indexOf('/');
  return slash === -1 ? '' : row.position.slice(0, slash);
}

/** Search by angler or stand: "radu", "A7", "a 7", "7". */
export function matchesRankingSearch(row: Pick<RankingRowData, 'position' | 'participant'>, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('ro');
  if (!q) return true;
  const stand = row.position.replace('/', '').toLocaleLowerCase('ro');
  const standNumber = row.position.slice(row.position.indexOf('/') + 1).toLocaleLowerCase('ro');
  const compactQ = q.replace(/\s+/g, '');
  const named = row.participant !== EMPTY_STAND;
  return (
    (named && row.participant.toLocaleLowerCase('ro').includes(q)) || stand === compactQ || standNumber === compactQ || stand.startsWith(compactQ)
  );
}

/**
 * The palette letter each sector of a built table is coloured with (fish's by-index colours, carried
 * on the rows' backgroundColor): for the dots and edges drawn outside the table (the sector chips,
 * the «Pe sectoare» titles, the side column), so they match the table's fills. A sector the rows do
 * not colour keeps its own name (sector.ts sectorFill then falls back to the given colour).
 */
export function sectorLetters(rows: ReadonlyArray<Pick<RankingRowData, 'position' | 'backgroundColor'>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const sector = rowSector(row);
    if (!out.has(sector)) out.set(sector, paletteLetter(row.backgroundColor) ?? sector);
  }
  return out;
}

/** Sector names present in a ranking, A→X order. */
export function sectorsOf(rows: ReadonlyArray<Pick<RankingRowData, 'position'>>): string[] {
  return [...new Set(rows.map(rowSector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * One weight precision per competition: the most decimals any weight of its ranking has (1 to 3),
 * so every weight of the page's tiles prints the same way and a column of them lines up on the
 * comma («28,500 / 48,549», never «28,5 / 48,549»).
 */
export function weightDecimals(table: RankingTableData | null | undefined): number {
  if (!table) return 1;
  const keys = toWebColumns(table.columns)
    .filter(c => c.kind === 'weight' || c.kind === 'catch')
    .map(c => c.key);
  let decimals = 1;
  for (const row of table.rows) {
    for (const key of keys) {
      const n = cellNumber(row[key]);
      if (n === null) continue;
      const frac = Math.abs(n).toFixed(3).split('.')[1].replace(/0+$/, '');
      if (frac.length > decimals) decimals = frac.length;
      if (decimals === 3) return 3;
    }
  }
  return decimals;
}

/** A weight at the competition's precision (weightDecimals): «2.961,000». */
export function formatKg(n: number, decimals: number): string {
  return formatDecimal(n, decimals, decimals);
}

/**
 * The precision for the rankings the shared builders do not draw (feeder legs, the club rankings):
 * their tables always print three decimals (fish), so the page's tiles do too — one precision on
 * one screen («21,000 kg» over «34,700», never «21,0»).
 */
export function rawWeightDecimals(data: RankingResponse | undefined): number {
  if (!data) return 1;
  return data.metadata.rankingType === 'feederRounds' || isNationalChampionshipRankings(data.rankings) ? 3 : 1;
}
