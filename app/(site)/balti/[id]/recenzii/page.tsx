import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { lakeQuery, lakeReviewsInfiniteQuery, type GetReviewsForLakeResponse, type LakeDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { jsonLdHtml } from '@/lib/json-ld';
import { reviewScoreSentence, reviewsJsonLd } from '@/lib/seo/reviews';
import { breadcrumbJsonLd, lakeSubpageEmpty, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { ReviewsFallback, ReviewsScreen } from './ReviewsScreen';

/*
 * Recenzii — fish app/(app)/lakes/[lakeId]/reviews.tsx (parity lakes.reviews, T1). Public and
 * static: the lake (its scores) and the first page of reviews are cached public CMS reads
 * (`/feed/lakes/:id`, `/feed/lakes/:id/reviews`, purged by the lake's tag on a review write)
 * prefetched into the HTML; the client takes the same queries over, loads the next pages and reads
 * the viewer's own review (per-user, browser only). The dev fault switch names the reads
 * `reviews-page`.
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  const ids = await lakeIdsToPrerender();
  return (ids.length ? ids : ['_']).map(id => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') return { title: 'Balta nu a fost găsită' };
  // The score is the JSON-LD's AggregateRating (lib/seo/reviews.ts): one number, one rounding.
  return subMetadata(load.lake, {
    title: 'Recenzii',
    description: `Recenziile pescarilor despre ${load.lake.name}: pescuit, facilități și atmosferă.${reviewScoreSentence(load.lake.reviewsMeta)}`,
    path: routes.lakeReviews(load.lake.documentId),
    empty: await lakeSubpageEmpty(load.lake, 'recenzii'),
  });
}

export default async function LakeReviewsPage({ params }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Recenzii')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, 'Recenzii', routes.lakeReviews(lake.documentId)))} />
      {/* The reviews' reads behind the page's own skeleton, under the lake's name (loading.tsx is
          only for the lake read itself). */}
      <Suspense fallback={<ReviewsFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Reviews lake={lake} />
      </Suspense>
    </>
  );
}

async function Reviews({ lake }: { lake: LakeDetail }) {
  const { state } = await prefetchSub(lake.documentId, 'reviews-page', t => [lakeQuery(t, lake.documentId), lakeReviewsInfiniteQuery(t, lake.documentId, 10)]);
  // The lake with its rating and the first page of reviews as the page shows them — only when the
  // lake has reviews (no AggregateRating of nothing).
  const first = (state.queries[1]?.state.data as { pages?: GetReviewsForLakeResponse[] } | undefined)?.pages?.[0]?.data ?? [];
  const ld = reviewsJsonLd(lake, routes.lakeReviews(lake.documentId), first);
  return (
    <HydrationBoundary state={state}>
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} /> : null}
      <ReviewsScreen lakeId={lake.documentId} lakeName={lake.name} />
    </HydrationBoundary>
  );
}
