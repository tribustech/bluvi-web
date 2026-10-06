/*
 * The one number a ranking row is judged by, per ranking type — what a results row, a podium or a
 * live leaderboard shows next to a name. Read from the CMS ranking payloads
 * (fir-intins-cms src/api/competition/services/rankings/*) and fish's tables
 * (helpers/table/getTableColumns.ts, createTableRows.ts, NationalChampionshipTable.tsx,
 * FeederRankingTable.tsx):
 *
 *  - quantity              kg total (`quantity`)
 *  - quality               calitate, kg (`quality`: the average of the sector's top N catches)
 *  - bestOf                medie, kg (`topNCatchesAvarage`, the CMS spelling)
 *  - bestOfTiers           medie Best N, kg: the average at the tier the row won at —
 *                          `topNByTier[bestOfTierSizes[tierWonAt − 1]]` (fish isTierWin cell)
 *  - quantityQuality,
 *    qualityQuantity       puncte, fewest win: `qualityPoints + quantityPoints` (fish totalPoints)
 *  - calitateCalitate,
 *    calitateCantitateCMMC puncte, fewest win (`totalPoints`; the payload has no `quality` field)
 *  - nationalChampionship,
 *    fipsed                puncte lot, fewest win (`clubPoints`, the sum of the club's sector places)
 *  - feederRounds          puncte, fewest win (`totalPoints`, the sum of the leg points)
 *
 * A value the row does not carry is null — never another field passed off under this label.
 */

export type HeadlineUnit = 'kg' | 'puncte';

export type ResultHeadline = {
  value: number | null;
  unit: HeadlineUnit;
  /** The caption of `value`: «kg total», «calitate», «medie», «medie Best 9», «puncte». */
  label: string;
  /** Points rankings: the fewest lead. */
  lowerIsBetter: boolean;
};

type Raw = Record<string, unknown>;

const num = (r: Raw | null | undefined, k: string): number | null => {
  const v = r?.[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

const kg = (value: number | null, label: string): ResultHeadline => ({ value, unit: 'kg', label, lowerIsBetter: false });
const points = (value: number | null): ResultHeadline => ({ value, unit: 'puncte', label: 'puncte', lowerIsBetter: true });

/** bestOfTiers: the average at the tier the row won at (1-based into the metadata's tier sizes). */
function tierAverage(row: Raw, metadata: Raw | null | undefined): ResultHeadline {
  const sizes = Array.isArray(metadata?.bestOfTierSizes) ? (metadata.bestOfTierSizes as unknown[]) : [];
  const wonAt = num(row, 'tierWonAt');
  const size = wonAt != null ? sizes[wonAt - 1] : undefined;
  const byTier = row.topNByTier && typeof row.topNByTier === 'object' ? (row.topNByTier as Raw) : null;
  if (typeof size !== 'number' || !byTier) return kg(null, 'medie');
  return kg(num(byTier, String(size)), `medie Best ${size}`);
}

export function resultHeadline(rankingType: string | null | undefined, row: Raw, metadata?: Raw | null): ResultHeadline {
  switch (rankingType) {
    case 'quality':
      return kg(num(row, 'quality'), 'calitate');
    case 'bestOf':
      return kg(num(row, 'topNCatchesAvarage'), 'medie');
    case 'bestOfTiers':
      return tierAverage(row, metadata);
    case 'quantityQuality':
    case 'qualityQuantity': {
      const q = num(row, 'qualityPoints');
      const n = num(row, 'quantityPoints');
      return points(q != null && n != null ? q + n : null);
    }
    case 'calitateCalitate':
    case 'calitateCantitateCMMC':
    case 'feederRounds':
      return points(num(row, 'totalPoints'));
    case 'nationalChampionship':
    case 'fipsed':
      return points(num(row, 'clubPoints'));
    default:
      // quantity, and any type this build does not know yet: the weight it says it has.
      return kg(num(row, 'quantity'), 'kg total');
  }
}
