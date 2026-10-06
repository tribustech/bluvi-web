import type {
  BaseStandRanking,
  BestNStandRanking,
  BestOfTiersStandRanking,
  CalitateCalitateStandRanking,
  QuantityStandRanking,
  QualityQuantityStandRanking,
  QualityQuantityCMMCStandRanking,
  QualityStandRanking,
  BestOfStandRanking,
  Penalty,
} from '../../schemas';
import { getCompetitorDisplayName } from './getCompetitorDisplayName';

/*
 * Ported VERBATIM from fish `helpers/table/createTableRows.ts`. These builders are kept in sync
 * with the public ranking docs (bluvi-docs); do not change behaviour here without updating them.
 */

/**
 * Per-row context computed by the caller (CompetitionRanking) from the response metadata.
 * Decouples row factories from RankingMetadata: the table just renders flags the row carries,
 * and each ranking type owns its own winner-detection and biggest-catch matching.
 */
export type RowContext = {
  /** True if this row is a "winner" — visual highlight (medal icon, accent background). */
  isWinner: boolean;
  /** Owner of the single biggest catch in the competition (null if none). */
  biggestStandId?: number | string | null;
  /** Weight of the biggest catch (null if none). Cells matching this value on the owner stand get isBiggest = true. */
  biggestWeight?: number | null;
};

export type CatchCell =
  | string
  | {
      weight: string;
      isSplit?: boolean;
      isBiggest?: boolean;
      /** True on every bestOfTiers "Best N" cell, so the table can render the block as one band. */
      isTier?: boolean;
      /** True on the single "Best N" cell where this competitor won their place. */
      isTierWin?: boolean;
    };

/**
 * Format a weight (kg) value for display as a fixed 3-decimal string, e.g. 64 → "64.000", 12.5 → "12.500".
 * Returns "-" for missing/NaN values so a corrupt cell degrades gracefully instead of throwing or printing "NaN".
 * Weights only — points columns are formatted separately (max 1 decimal) and must not use this.
 */
const kg = (n: number | null | undefined): string =>
  typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(3) : '-';

/**
 * Build the C.M.M.C / biggestFish cell. Emits the object form with `isBiggest: true`
 * when this stand owns the competition's overall biggest catch, so the renderer
 * highlights it the same way it highlights the matching catch cell.
 */
const biggestFishCell = (
  ranking: { standId: string | number; biggestFish: number },
  context: RowContext,
): CatchCell => {
  const weight = ranking.biggestFish.toFixed(3) || '-';
  const ownsBiggest =
    context.biggestStandId != null &&
    String(ranking.standId) === String(context.biggestStandId) &&
    context.biggestWeight != null &&
    ranking.biggestFish === context.biggestWeight;
  return ownsBiggest ? { weight, isBiggest: true } : weight;
};

export type BaseRowType = {
  standId: string;
  position: string;
  participant: string;
  sectorPosition: number;
  generalPosition: number;
  backgroundColor: string;
  penalties: Penalty[];
  isWinner: boolean;
};

export type QuantityRowType = BaseRowType & {
  biggestFish: number | string;
  quantity: string;
  catchCount: number;
  quantityPoints: number;
  totalPoints: number;
};

export type QualityRowType = BaseRowType & {
  quality: string;
  qualityPoints: number;
  totalPoints: number;
  sectorMinNumberOfFish: number;
  catchCount: number;
  [key: `catch${number}`]: CatchCell;
};

export type QualityQuantityRowType = BaseRowType & {
  quality: string;
  quantity: string;
  catchCount: number;
  qualityPoints: number;
  quantityPoints: number;
  totalPoints: number;
  sectorMinNumberOfFish: number;
  [key: `catch${number}`]: CatchCell;
};

export type BestOfRowType = BaseRowType & {
  bestOfCount: number;
  topNCatchesAvarage: string;
  [key: `catch${number}`]: CatchCell;
};

export const createBaseRow = (
  ranking: BaseStandRanking,
  sectorColors: Record<string, string>,
  context: RowContext,
): BaseRowType => ({
  standId: String(ranking.standId),
  position: `${ranking.sectorName}/${ranking.standName}`,
  participant: getCompetitorDisplayName({
    teamName: ranking.teamName,
    participantNames: ranking.participant ? [ranking.participant.username] : [],
    guestName: ranking.guestName,
  }),
  sectorPosition: ranking.sectorPosition,
  generalPosition: ranking.generalPosition,
  backgroundColor: sectorColors[ranking.sectorName],
  penalties: ranking.penalties ?? [],
  isWinner: context.isWinner,
});

const createCatchesEntries = (
  ranking:
    | QualityStandRanking
    | QualityQuantityStandRanking
    | BestOfStandRanking
    | CalitateCalitateStandRanking
    | QualityQuantityCMMCStandRanking,
  maxCatchesToShow: number,
  context: RowContext,
): Record<string, CatchCell> => {
  const ownsBiggest =
    // fish compares a numeric ranking standId to a string here, so its catch cells are never
    // flagged (parity competition-page.clasament.c19, a fish bug): compare both as strings.
    context.biggestStandId != null && String((ranking as BaseStandRanking).standId) === String(context.biggestStandId);
  return Object.fromEntries(
    ranking.catches.slice(0, maxCatchesToShow).map((catch_, index) => {
      const rawWeight = typeof catch_ === 'number' ? catch_ : catch_.weight;
      const isSplit = typeof catch_ === 'object' && catch_.isSplit ? true : false;
      const isBiggest = ownsBiggest && context.biggestWeight != null && rawWeight === context.biggestWeight;
      const weight = rawWeight.toFixed(3);
      // Only emit object form when at least one flag is set — keeps payload small and matches the legacy
      // "plain string for flagless cells" convention the renderer already understands.
      if (isSplit || isBiggest) {
        return [`catch${index + 1}`, { weight, isSplit, isBiggest }];
      }
      return [`catch${index + 1}`, weight];
    }),
  );
};

export const createQuantityRow = (
  ranking: QuantityStandRanking,
  sectorColors: Record<string, string>,
  context: RowContext,
): QuantityRowType => ({
  ...createBaseRow(ranking, sectorColors, context),
  biggestFish: ranking.biggestFish.toFixed(3) || '-',
  quantity: ranking.quantity.toFixed(3),
  catchCount: ranking.catchCount || 0,
  quantityPoints: parseFloat(ranking.quantityPoints.toFixed(3)),
  totalPoints: parseFloat(ranking.quantityPoints.toFixed(3)),
});

export const createQualityRow = (
  ranking: QualityStandRanking,
  nrOfCatchesColumns: number,
  sectorColors: Record<string, string>,
  context: RowContext,
): QualityRowType => {
  return {
    ...createBaseRow(ranking, sectorColors, context),
    ...createCatchesEntries(ranking, nrOfCatchesColumns, context),
    catchCount: ranking.catchCount || 0,
    quality: kg(ranking.quality),
    qualityPoints: parseFloat(ranking.qualityPoints.toFixed(3)),
    totalPoints: parseFloat(ranking.qualityPoints.toFixed(3)),
    sectorMinNumberOfFish: ranking.sectorMinNumberOfFish,
  };
};

export const createQualityQuantityRow = (
  ranking: QualityQuantityStandRanking,
  nrOfCatchesColumns: number,
  sectorColors: Record<string, string>,
  context: RowContext,
): QualityQuantityRowType => ({
  ...createBaseRow(ranking, sectorColors, context),
  ...createCatchesEntries(ranking, nrOfCatchesColumns, context),
  quality: kg(ranking.quality),
  quantity: ranking.quantity.toFixed(3),
  catchCount: ranking.catchCount || 0,
  qualityPoints: parseFloat(ranking.qualityPoints.toFixed(3)),
  quantityPoints: parseFloat(ranking.quantityPoints.toFixed(3)),
  totalPoints: parseFloat(ranking.qualityPoints.toFixed(3)) + parseFloat(ranking.quantityPoints.toFixed(3)),
  sectorMinNumberOfFish: ranking.sectorMinNumberOfFish,
});

export const createBestOfRow = (
  ranking: BestOfStandRanking,
  bestOfFishCount: number,
  sectorColors: Record<string, string>,
  context: RowContext,
): BestOfRowType => {
  return {
    ...createBaseRow(ranking, sectorColors, context),
    ...createCatchesEntries(ranking, bestOfFishCount, context),
    bestOfCount: ranking.bestOfCount || 0,
    topNCatchesAvarage: kg(ranking.topNCatchesAvarage),
  };
};

export type CalitateCalitateRowType = BaseRowType & {
  quality1: string;
  biggestFish: CatchCell;
  catchCount: number;
  quality1Points: number;
  quality2Points: number;
  totalPoints: number;
  sectorMinNumberOfFish: number;
  [key: `catch${number}`]: CatchCell;
};

export const createCalitateCalitateRow = (
  ranking: CalitateCalitateStandRanking,
  nrOfCatchesColumns: number,
  sectorColors: Record<string, string>,
  context: RowContext,
): CalitateCalitateRowType => ({
  ...createBaseRow(ranking, sectorColors, context),
  ...createCatchesEntries(ranking, nrOfCatchesColumns, context),
  quality1: kg(ranking.quality1),
  biggestFish: biggestFishCell(ranking, context),
  catchCount: ranking.catchCount || 0,
  quality1Points: parseFloat(ranking.quality1Points.toFixed(3)),
  quality2Points: parseFloat(ranking.quality2Points.toFixed(3)),
  totalPoints: parseFloat(ranking.quality1Points.toFixed(3)) + parseFloat(ranking.quality2Points.toFixed(3)),
  sectorMinNumberOfFish: ranking.sectorMinNumberOfFish,
});

export type QualityQuantityCMMCRowType = BaseRowType & {
  quality1: string;
  biggestFish: CatchCell;
  quantity: string;
  catchCount: number;
  calitatePoints: number;
  cmmcPoints: number;
  cantitatePoints: number;
  totalPoints: number;
  sectorMinNumberOfFish: number;
  [key: `catch${number}`]: CatchCell;
};

export const createQualityQuantityCMMCRow = (
  ranking: QualityQuantityCMMCStandRanking,
  nrOfCatchesColumns: number,
  sectorColors: Record<string, string>,
  context: RowContext,
): QualityQuantityCMMCRowType => ({
  ...createBaseRow(ranking, sectorColors, context),
  ...createCatchesEntries(ranking, nrOfCatchesColumns, context),
  quality1: kg(ranking.quality1),
  biggestFish: biggestFishCell(ranking, context),
  quantity: kg(ranking.quantity),
  catchCount: ranking.catchCount || 0,
  calitatePoints: ranking.calitatePoints,
  cmmcPoints: ranking.cmmcPoints,
  cantitatePoints: ranking.cantitatePoints,
  totalPoints: ranking.totalPoints,
  sectorMinNumberOfFish: ranking.sectorMinNumberOfFish,
});

export type BestOfTiersRowType = BaseRowType & {
  catchCount: number;
  [key: `catch${number}`]: CatchCell;
  /** Average of the top N catches at each configured tier — `tier9`, `tier7`, … */
  [key: `tier${number}`]: CatchCell;
};

export const createBestOfTiersRow = (
  ranking: BestOfTiersStandRanking,
  catchColumnCount: number,
  sectorColors: Record<string, string>,
  context: RowContext,
  tiers: number[] = [],
): BestOfTiersRowType => {
  const ownsBiggest =
    context.biggestStandId != null && String(ranking.standId) === String(context.biggestStandId);
  const catchEntries: Record<string, CatchCell> = {};
  for (let i = 0; i < catchColumnCount; i++) {
    const c = ranking.catches?.[i];
    if (c === undefined) continue;
    const weight = c.weight.toFixed(3);
    const isBiggest = ownsBiggest && context.biggestWeight != null && c.weight === context.biggestWeight;
    catchEntries[`catch${i + 1}`] = isBiggest ? { weight, isBiggest: true } : weight;
  }

  // One cell per tier: the average of the top N catches, or 0.000 when the competitor never
  // reached N catches. Every cell carries isTier so the table renders the block as one band;
  // the tier the competitor actually won at additionally gets isTierWin.
  const tierEntries: Record<string, CatchCell> = {};
  tiers.forEach((tier, index) => {
    const average = ranking.topNByTier?.[tier];
    const weight = average == null ? '0.000' : average.toFixed(3);
    tierEntries[`tier${tier}`] =
      average != null && ranking.tierWonAt === index + 1
        ? { weight, isTier: true, isTierWin: true }
        : { weight, isTier: true };
  });

  return {
    ...createBaseRow(ranking, sectorColors, context),
    catchCount: ranking.catchCount,
    ...catchEntries,
    ...tierEntries,
  };
};

export type BestNRowType = {
  position: string;
  participant: string;
  averageBestN: string;
  catchCount: number;
  generalPosition: number;
  backgroundColor: string;
  isWinner: boolean;
};

export const createBestNRow = (
  ranking: BestNStandRanking,
  sectorColors: Record<string, string>,
  context: RowContext,
): BestNRowType => ({
  position: `${ranking.sectorName}/${ranking.standName}`,
  participant:
    ranking.guestName || (ranking.teamName ? ranking.teamName : ranking.participant?.username || '-'),
  averageBestN: kg(ranking.averageBestN),
  catchCount: ranking.catchCount,
  generalPosition: ranking.position,
  backgroundColor: sectorColors[ranking.sectorName] ?? '#f0f0f0',
  isWinner: context.isWinner,
});
