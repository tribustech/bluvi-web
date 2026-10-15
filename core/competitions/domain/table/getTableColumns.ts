/* Ported verbatim from fish `helpers/table/getTableColumns.ts` (synced with the public ranking docs). */
import type { BestOfStandRanking, BestOfTiersStandRanking } from '../../schemas';
export type ColumnDefinition = {
  key: string;
  title: string;
  /** True on bestOfTiers "Best N" columns, so the header shares the block's fill. */
  isTier?: boolean;
};

const baseColumns: ColumnDefinition[] = [
  { key: 'position', title: 'Stand' },
  { key: 'participant', title: 'Participant' },
];

const positionColumns = [
  { key: 'sectorPosition', title: 'Poziție sector' },
  { key: 'generalPosition', title: 'Poziție generală' },
];

export const getQuantityColumns = (): ColumnDefinition[] => {
  return [
    ...baseColumns,
    { key: 'biggestFish', title: 'C.M.M.C' },
    { key: 'quantity', title: 'Cantitate' },
    { key: 'catchCount', title: 'Nr. Buc' },
    { key: 'quantityPoints', title: 'Puncte cantitate' },
    ...positionColumns,
  ];
};

export const getQualityColumns = (catchesCount: number): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchesCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));

  return [
    ...baseColumns,
    ...catchColumns,
    { key: 'quality', title: 'Calitate' },
    { key: 'catchCount', title: 'Nr. Buc' },
    ...positionColumns,
  ];
};

export const getQualityQuantityColumns = (catchesCount: number): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchesCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));

  return [
    ...baseColumns,
    ...catchColumns,
    { key: 'quality', title: 'Calitate' },
    { key: 'quantity', title: 'Cantitate' },
    { key: 'catchCount', title: 'Nr. Buc' },
    { key: 'qualityPoints', title: 'Puncte calitate' },
    { key: 'quantityPoints', title: 'Puncte cantitate' },
    { key: 'totalPoints', title: 'Puncte total' },
    ...positionColumns,
  ];
};

/**
 * Catch columns of a bestOf table: as many as the stand with the most fish (every fish is shown).
 * An older CMS sends only the top-N fish (`catches`), so the count falls back to those. At least 3.
 */
export const bestOfCatchColumnCount = (rankings: BestOfStandRanking[]): number =>
  rankings.reduce((max, r) => Math.max(max, (r.allCatches ?? r.catches ?? []).length), 0) || 3;

/** Catch columns of a bestOfTiers table: as many as the stand with the most fish. */
export const bestOfTiersCatchColumnCount = (rankings: BestOfTiersStandRanking[]): number =>
  rankings.reduce((max, r) => Math.max(max, r.catchCount ?? 0), 0);

export const getBestOfColumns = (catchColumnCount: number, numberOfSectors: number): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchColumnCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));
  return [
    ...baseColumns,
    { key: 'bestOfCount', title: 'Nr buc.' },
    ...catchColumns,
    { key: 'topNCatchesAvarage', title: 'Medie (kg)' },
    ...(numberOfSectors > 1 ? [{ key: 'sectorPosition', title: 'Poziție sector' }] : []),
    { key: 'generalPosition', title: 'Poziție generală' },
  ];
};

export const getBestOfTiersColumns = (catchColumnCount: number, tiers: number[] = []): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchColumnCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));
  // One column per configured tier, holding the average of that competitor's top N catches —
  // the value the placement is actually decided on. Displayed small → big (Best 3 … Best 9).
  const tierColumns = [...tiers]
    .sort((a, b) => a - b)
    .map(tier => ({
      key: `tier${tier}`,
      title: `Best ${tier}`,
      isTier: true,
    }));
  return [
    ...baseColumns,
    ...catchColumns,
    { key: 'catchCount', title: 'Nr. Buc' },
    ...tierColumns,
    { key: 'generalPosition', title: 'Poziție generală' },
  ];
};

export const getCalitateCalitateColumns = (catchesCount: number): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchesCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));

  return [
    ...baseColumns,
    ...catchColumns,
    { key: 'quality1', title: 'Calitate 1' },
    { key: 'biggestFish', title: 'C.M.M.C' },
    { key: 'catchCount', title: 'Nr. Buc' },
    { key: 'quality1Points', title: 'Puncte Cal. 1' },
    { key: 'quality2Points', title: 'Puncte Cal. 2' },
    { key: 'totalPoints', title: 'Puncte total' },
    ...positionColumns,
  ];
};

export const getQualityQuantityCMMCColumns = (catchesCount: number): ColumnDefinition[] => {
  const catchColumns = Array.from({ length: catchesCount }, (_, index) => ({
    key: `catch${index + 1}`,
    title: `${index + 1}`,
  }));

  return [
    ...baseColumns,
    ...catchColumns,
    { key: 'quality1', title: 'Calitate' },
    { key: 'quantity', title: 'Cantitate' },
    { key: 'biggestFish', title: 'C.M.M.C' },
    { key: 'catchCount', title: 'Nr. Buc' },
    { key: 'calitatePoints', title: 'Pct. Cal.' },
    { key: 'cantitatePoints', title: 'Pct. Cant.' },
    { key: 'cmmcPoints', title: 'Pct. CMMC' },
    { key: 'totalPoints', title: 'Puncte total' },
    ...positionColumns,
  ];
};

export const getBestNColumns = (): ColumnDefinition[] => [
  { key: 'position', title: 'Stand' },
  { key: 'participant', title: 'Participant' },
  { key: 'averageBestN', title: 'Medie (kg)' },
  { key: 'catchCount', title: 'Nr. Buc' },
  { key: 'generalPosition', title: 'Poziție' },
];
