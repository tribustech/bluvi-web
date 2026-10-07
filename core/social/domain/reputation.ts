import type { AnglerReview } from '../schemas';
import { formatCount } from '../../realtime/chat/format';
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

/** "1 evaluare" / "3 evaluări" / "25 de evaluări" (formatCount: the «de» from 20). */
export function ratingCountLabel(count: number): string {
  return formatCount(count, 'evaluare', 'evaluări');
}

/**
 * The words under a figure drawn on its own line («20» over «de neprezentări»): formatCount's
 * phrase without the number, so the «de» from 20 stays (owner rule: correct plurals, formatCount).
 */
export function figureLabel(count: number, singular: string, plural: string): string {
  return formatCount(count, singular, plural).slice(String(count).length + 1);
}

/** "neprezentare" / "neprezentări" / "de neprezentări" (the number is rendered separately). */
export function noShowLabel(count: number): string {
  return figureLabel(count, 'neprezentare', 'neprezentări');
}
