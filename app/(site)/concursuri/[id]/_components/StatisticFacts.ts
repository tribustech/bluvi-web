/*
 * The small facts of the Statistici bento (owner rule 9), from the ranking metadata and who the
 * catches are counted over (EntrantCounts: the ranking's stands, else the feeder entrants or the
 * club rankings' teams — DesktopStats entrantCounts, the same counts the strip over the views says):
 * the average catch, the average per stand / team / angler (kg and catches), those with fish and
 * those without. Pure, so the arithmetic is tested apart from the view. A fact the data cannot back
 * is null and its tile is not drawn («when we don't know, we don't show», rule 4).
 */
export interface EntrantCountsLike {
  total: number;
  withFish: number;
  /** «stand» / «echipă» / «participant». */
  one: string;
  /** «standuri» / «echipe» / «participanți». */
  many: string;
}

export interface StatisticFacts {
  /** totalQuantity / totalCatchesCount (kg); null without a catch. */
  perCatch: number | null;
  /** The per-entrant facts (and what an entrant is); null when nobody is counted. */
  stands:
    | { total: number; withFish: number; without: number; perStandKg: number; catchesPerStand: number; one: string; many: string }
    | null;
}

export function statisticFacts(
  metadata: { totalCatchesCount: number; totalQuantity: number },
  counts: EntrantCountsLike | null | undefined,
): StatisticFacts {
  const catches = metadata.totalCatchesCount;
  const perCatch = catches > 0 ? metadata.totalQuantity / catches : null;
  const total = counts?.total ?? 0;
  if (!counts || total === 0 || catches === 0) return { perCatch, stands: null };
  return {
    perCatch,
    stands: {
      total,
      withFish: counts.withFish,
      without: total - counts.withFish,
      perStandKg: metadata.totalQuantity / total,
      catchesPerStand: catches / total,
      one: counts.one,
      many: counts.many,
    },
  };
}
