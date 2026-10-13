import { formatReviewsCount, type LakeDetail, type Review } from '@/core/lakes';
import { aggregateRatingJsonLd } from '@/lib/json-ld';
import { absoluteUrl } from '@/lib/routes';
import { lakePlaceJsonLd } from './lake-place';

/*
 * The lake's Recenzii page as JSON-LD: the lake (lakePlaceJsonLd, as on its own page) with an
 * AggregateRating and the reviews the page lists. The page shows three scores per lake and per
 * review (calitate, facilități, atmosferă), not one: a rating here is their mean, rounded as the
 * page rounds a score (the lake page's own AggregateRating is the overall score it shows). Nothing
 * is emitted for a lake without reviews (rule 4).
 */

const mean = (a: number, b: number, c: number) => (a + b + c) / 3;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The lake's score as the page shows a score (one decimal) — the mean of the three scores, the one
 * number the AggregateRating and the meta description both use. null without reviews or scores.
 */
export function lakeReviewScore(meta: LakeDetail['reviewsMeta']): number | null {
  if (!meta || meta.count <= 0) return null;
  const m = mean(meta.quality, meta.facilities, meta.atmosphere);
  return Number.isFinite(m) && m > 0 ? round1(m) : null;
}

/** The description's score sentence: « Nota medie 4,3 din 5 (1 recenzie).», or '' without a score. */
export function reviewScoreSentence(meta: LakeDetail['reviewsMeta']): string {
  const score = lakeReviewScore(meta);
  return score === null || !meta ? '' : ` Nota medie ${score.toFixed(1).replace('.', ',')} din 5 (${formatReviewsCount(meta.count)}).`;
}

export function reviewsJsonLd(lake: Parameters<typeof lakePlaceJsonLd>[0] & Pick<LakeDetail, 'reviewsMeta'>, path: string, reviews: Review[]) {
  const meta = lake.reviewsMeta;
  if (!meta || meta.count <= 0) return null;
  const rating = aggregateRatingJsonLd(lakeReviewScore(meta), meta.count);
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
