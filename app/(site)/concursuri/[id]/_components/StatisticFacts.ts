/*
 * The small facts of the Statistici bento (owner rule 9), from the ranking metadata and rows: the
 * average catch, the average per stand (kg and catches), the stands with fish and the stands without. Pure, so the
 * arithmetic is tested apart from the view. A fact the data cannot back is null and its tile is not
 * drawn («when we don't know, we don't show», rule 4): the club rankings have no rows, so they have
 * no per-stand facts.
 */
export interface StatisticFacts {
  /** totalQuantity / totalCatchesCount (kg); null without a catch. */
  perCatch: number | null;
  /** The per-stand facts; null when the rows are not there. */
  stands: { total: number; withFish: number; without: number; perStandKg: number; catchesPerStand: number } | null;
}

export function statisticFacts(
  metadata: { totalCatchesCount: number; totalQuantity: number },
  rows: readonly { catchCount?: unknown }[] | undefined,
): StatisticFacts {
  const catches = metadata.totalCatchesCount;
  const perCatch = catches > 0 ? metadata.totalQuantity / catches : null;
  const total = rows?.length ?? 0;
  if (total === 0 || catches === 0) return { perCatch, stands: null };
  const withFish = rows!.filter(r => typeof r.catchCount === 'number' && r.catchCount > 0).length;
  return {
    perCatch,
    stands: { total, withFish, without: total - withFish, perStandKg: metadata.totalQuantity / total, catchesPerStand: catches / total },
  };
}
