import type { CatchData, WeighingByStand, WeighingDetail, WeighingRevision } from '../schemas';

/** fish `api/weighing.ts#getWeightingsTotal` body: sum of every catch of every weighing, 3 decimals. */
export function sumWeighingsTotal(weighings: Pick<WeighingByStand, 'catches'>[]): string {
  let weightingsTotal = 0;
  weighings.forEach(weighing => {
    const totalWeight = weighing.catches?.reduce((acc, c) => acc + c.weight, 0);
    weightingsTotal += totalWeight;
  });
  return weightingsTotal.toFixed(3);
}

/** fish `useWeighingRevisions` queryFn: revisions grouped by `sessionId` (one close/reopen cycle). */
export function groupRevisionsBySession(revisions: WeighingRevision[] | undefined): Record<number, WeighingRevision[]> {
  return (
    revisions?.reduce(
      (acc, revision) => {
        if (!acc[revision.sessionId]) {
          acc[revision.sessionId] = [];
        }
        acc[revision.sessionId].push(revision);
        return acc;
      },
      {} as Record<number, WeighingRevision[]>
    ) || {}
  );
}

/**
 * Splits a total weight into `numParts` catches, each a multiple of the scale `unit`,
 * the rounding remainder landing on the first part. fish `helpers/splitWeightWithScaleConstraint.ts`
 */
export function splitWeightWithScaleConstraint(totalKg: number, numParts: number, unit = 0.025): number[] {
  // Împărțim inițial greutatea totală
  const baseWeight = Math.round((totalKg / numParts) * 1000) / 1000;

  // Rotunjim fiecare parte la cel mai apropiat multiplu de unit
  let weights: number[] = Array(numParts).fill(Math.round(baseWeight / unit) * unit);

  // Calculăm diferența față de totalul inițial
  const currentTotal = weights.reduce((sum, w) => sum + w, 0);
  const difference = totalKg - currentTotal;

  // Ajustăm prima parte pentru a compensa diferența
  weights[0] += Math.round(difference / unit) * unit;

  // Optional: re-rotunjim la 3 zecimale (doar pentru afișare frumoasă)
  weights = weights.map(w => Math.round(w * 1000) / 1000);

  return weights;
}

/* ------------------------------------------------------------------ */
/* Optimistic cache helpers — fish mutations/useAddCatchToWeighing.ts  */
/* ------------------------------------------------------------------ */

export const OPTIMISTIC_CATCH_ID_PREFIX = 'optimistic-catch-';

export const isOptimisticCatchId = (documentId: string | undefined) =>
  !!documentId?.startsWith(OPTIMISTIC_CATCH_ID_PREFIX);

/**
 * Prepends the submitted catches to a cached weighing so the operator sees what they just
 * weighed without a round-trip. fish builds `{ documentId, weight, fishType }` only; the web
 * cache is typed, so phantom rows also get a negative `id` and empty `media`.
 */
export function applyOptimisticCatches(
  weighing: WeighingDetail,
  data: CatchData,
  fishTypeName?: string
): WeighingDetail {
  const optimisticCatches = data.map((item, index) => ({
    id: -(index + 1),
    documentId: `${OPTIMISTIC_CATCH_ID_PREFIX}${index}`,
    weight: item.weight,
    fishType: { Name: fishTypeName ?? '' },
    media: [],
  }));
  return { ...weighing, catches: [...optimisticCatches, ...(weighing.catches ?? [])] };
}

/** fish `useReopenCantar#onMutate`: flips the reopened weighing back to `started` in the stand list. */
export function applyReopenToWeighings(
  weighings: WeighingByStand[] | undefined,
  weighingId: string
): WeighingByStand[] {
  return (
    weighings?.map(weighing =>
      weighing.documentId === weighingId ? { ...weighing, weighingStatus: 'started' as const } : weighing
    ) || []
  );
}
