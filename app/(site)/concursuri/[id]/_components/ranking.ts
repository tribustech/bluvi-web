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
  type ColumnDefinition,
  type QualityQuantityCMMCStandRanking,
  type QualityQuantityStandRanking,
  type QualityStandRanking,
  type QuantityStandRanking,
  type RankingResponse,
} from '@/core/competitions';
import { sectorColorMap, type RankingRowData } from '@/components/ranking';

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

  const sectorColors = sectorColorMap();
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

  return { columns, rows: rows.map(withPlainStand) };
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
  return (
    row.participant.toLocaleLowerCase('ro').includes(q) || stand === compactQ || standNumber === compactQ || stand.startsWith(compactQ)
  );
}

/** Sector names present in a ranking, A→X order. */
export function sectorsOf(rows: ReadonlyArray<Pick<RankingRowData, 'position'>>): string[] {
  return [...new Set(rows.map(rowSector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
