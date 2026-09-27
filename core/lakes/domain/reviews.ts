import type { ClaimedPublicWater, Review, ReviewMeta, ReviewReqBody } from '../schemas';

/* fish `helpers/calculateOptimisticReviewMeta.ts` */

/** The lake's aggregate after the user edits their own review (count unchanged). */
export const calculateOptimisticReviewMeta = (
  currentMeta: ReviewMeta,
  oldReview: Pick<Review, 'quality' | 'facilities' | 'atmosphere'>,
  newReviewData: Pick<ReviewReqBody, 'quality' | 'facilities' | 'atmosphere'>
): ReviewMeta => {
  if (currentMeta.count === 0) return currentMeta;

  const qualityDiff = newReviewData.quality - oldReview.quality;
  const facilitiesDiff = newReviewData.facilities - oldReview.facilities;
  const atmosphereDiff = newReviewData.atmosphere - oldReview.atmosphere;

  const newQuality = (currentMeta.quality * currentMeta.count + qualityDiff) / currentMeta.count;
  const newFacilities = (currentMeta.facilities * currentMeta.count + facilitiesDiff) / currentMeta.count;
  const newAtmosphere = (currentMeta.atmosphere * currentMeta.count + atmosphereDiff) / currentMeta.count;
  const newOverall = (newQuality + newFacilities + newAtmosphere) / 3;

  return {
    quality: Math.round(newQuality * 100) / 100, // Round to 2 decimal places
    facilities: Math.round(newFacilities * 100) / 100,
    atmosphere: Math.round(newAtmosphere * 100) / 100,
    overall: Math.round(newOverall * 100) / 100,
    count: currentMeta.count,
  };
};

/* fish `helpers/formatReviewsCount.ts` */

/** Romanian pluralization for review counts: 1 recenzie / N recenzii. */
export function formatReviewsCount(count: number): string {
  return `${count} ${count === 1 ? 'recenzie' : 'recenzii'}`;
}

/* fish `features/lakes/helpers/lakeDetailLogic.ts#getLakeRatingDisplay` */

export interface LakeRatingDisplay {
  label: string;
  scoreLabel: string | null;
  reviewsLabel: string;
  accessibilityLabel: string;
}

export function getLakeRatingDisplay(reviewsMeta: Pick<ReviewMeta, 'overall' | 'count'> | null | undefined): LakeRatingDisplay {
  if (!reviewsMeta || reviewsMeta.count <= 0) {
    return {
      label: 'Fără recenzii',
      scoreLabel: null,
      reviewsLabel: 'Fără recenzii',
      accessibilityLabel: 'Recenzii: fără recenzii',
    };
  }
  const scoreLabel = (reviewsMeta.overall ?? 0).toFixed(2).replace('.', ',');
  const countLabel = formatReviewsCount(reviewsMeta.count);
  return {
    label: `${scoreLabel} · ${countLabel}`,
    scoreLabel,
    reviewsLabel: `· ${countLabel}`,
    accessibilityLabel: `Recenzii: ${scoreLabel} din 5, ${countLabel}`,
  };
}

/* fish `services/queries/useClaimedPublicWaters.ts` — the memoised map the hook returns */

/**
 * `Map<linkCode, lakeDocumentId>`. When a public water's ANAR `linkCode` is in this map, taps on
 * it route to the Lake page instead of the generic public-water detail. Empty until the query
 * resolves → nothing reroutes (safe fallback).
 */
export function toClaimedPublicWatersMap(data: ClaimedPublicWater[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of data ?? []) if (c.linkCode) map.set(c.linkCode, c.lakeDocumentId);
  return map;
}
