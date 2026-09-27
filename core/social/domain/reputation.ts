import type { AnglerReview } from '../schemas';
import { reviewTagLabel } from './reviewTags';

/**
 * Pure bits of fish `features/reputation/ReputationBlock.tsx`.
 *
 * Reviews written before the single-score change carry three sub-scores, and their true score is
 * the exact mean of those (5/4/5 → 4.7) — the stored integer `stars` is that mean rounded, so showing
 * it would round a 4.7 up to five full stars. New reviews have one score and use it as-is.
 */
export function anglerReviewOverall(review: Pick<AnglerReview, 'stars' | 'rulesScore' | 'cleanlinessScore' | 'behaviorScore'>): number {
  return review.rulesScore != null && review.cleanlinessScore != null && review.behaviorScore != null
    ? (review.rulesScore + review.cleanlinessScore + review.behaviorScore) / 3
    : review.stars;
}

/** Tag labels to show; an unknown key means a newer CMS — dropped rather than printed as a slug. */
export function anglerReviewTagLabels(review: Pick<AnglerReview, 'tags'>): string[] {
  return (review.tags ?? []).map(reviewTagLabel).filter((l): l is string => l != null);
}

/** "Autor · Baltă", or '' when neither is known. */
export function anglerReviewSubtitle(review: Pick<AnglerReview, 'authorName' | 'lakeName'>): string {
  return [review.authorName, review.lakeName].filter(Boolean).join(' · ');
}

/** "1 evaluare" / "N evaluări". */
export function ratingCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'evaluare' : 'evaluări'}`;
}

/** "neprezentare" / "neprezentări" (the number is rendered separately). */
export function noShowLabel(count: number): string {
  return count === 1 ? 'neprezentare' : 'neprezentări';
}
