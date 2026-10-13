import { formatReviewsCount, type LakeDetail, type Review } from '@/core/lakes';
import { aggregateRatingJsonLd } from '@/lib/json-ld';
import { absoluteUrl } from '@/lib/routes';
import { lakePlaceJsonLd } from './lake-place';

/*
 * The lake's Recenzii page as JSON-LD: the lake (lakePlaceJsonLd, as on its own page) with an
 * AggregateRating — the overall score the page shows above the three (lakeReviewScore) — and the
 * reviews the page lists, each rated by the mean of its three scores (calitate, facilități,
 * atmosferă), rounded as the page rounds a score. Nothing is emitted for a lake without reviews
 * (rule 4).
 */

const mean = (a: number, b: number, c: number) => (a + b + c) / 3;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The lake's overall score, two decimals — the one the lake page and the Recenzii page show
 * («4,67 din 5»), the CMS's `overall` (the mean of the three scores on a meta written before it
 * was computed): the one number the AggregateRating (lake page and Recenzii) and the meta
 * description use (Google: the rating marked up must be visible on the page). null without
 * reviews or scores.
 */
export function lakeReviewScore(meta: LakeDetail['reviewsMeta']): number | null {
  if (!meta || meta.count <= 0) return null;
  const m = meta.overall && meta.overall > 0 ? meta.overall : mean(meta.quality, meta.facilities, meta.atmosphere);
  return Number.isFinite(m) && m > 0 ? Math.round(m * 100) / 100 : null;
}

/** The overall score as the pages write it: «4,67». */
export const formatLakeScore = (score: number) => score.toFixed(2).replace('.', ',');

/** The description's score sentence: « Nota medie 4,3 din 5 (1 recenzie).», or '' without a score. */
export function reviewScoreSentence(meta: LakeDetail['reviewsMeta']): string {
  const score = lakeReviewScore(meta);
  return score === null || !meta ? '' : ` Nota medie ${formatLakeScore(score)} din 5 (${formatReviewsCount(meta.count)}).`;
}

export function reviewsJsonLd(lake: Parameters<typeof lakePlaceJsonLd>[0] & Pick<LakeDetail, 'reviewsMeta'>, path: string, reviews: Review[]) {
  const meta = lake.reviewsMeta;
  if (!meta || meta.count <= 0) return null;
  const rating = aggregateRatingJsonLd(lakeReviewScore(meta), meta.count, 2);
  if (!rating) return null;
  return {
    '@context': 'https://schema.org',
    ...lakePlaceJsonLd(lake),
    subjectOf: { '@type': 'WebPage', url: absoluteUrl(path), name: `Recenzii · ${lake.name}` },
    aggregateRating: rating,
    review: reviews.map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author?.username?.trim() || 'Pescar' },
      datePublished: r.createdAt,
      ...(r.comment?.trim() ? { reviewBody: r.comment.trim() } : {}),
      reviewRating: { '@type': 'Rating', ratingValue: round1(mean(r.quality, r.facilities, r.atmosphere)), bestRating: 5, worstRating: 1 },
    })),
  };
}
