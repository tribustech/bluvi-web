import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { param, type SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { loadLake } from '../_components/load';
import { lakeLocationLine } from '../_components/location';
import type { LakeSummary } from './_components/LakeSummaryAside';
import { ReviewFormScreen } from './_components/ReviewFormScreen';
import { ReviewFormSkeleton } from './_components/ReviewFormSkeleton';

/*
 * /balti/[id]/recenzie — add / edit the viewer's review of a lake (parity lakes.review-form, T4
 * single step). fish app/(app)/lakes/review/[lakeId].tsx + features/reviews/components/LakeReviewForms.
 *  - `?editare=1`: edit the viewer's own review (fish `isEditing`);
 *  - `?rezervare={bookingId}`: add from a completed booking, so the review is marked verified (fish
 *    `booking`, from Rezervările mele).
 * Signed in only (c10): the gate awaits the session inside the Suspense boundary (Cache Components),
 * with the query kept in `next` so /intra returns to the same mode. The lake (name, photo, location,
 * rating — the aside from 1280 and the header's eyebrow) is the cached public read the lake page
 * makes; the review itself is per user, read and written in the browser through /api/cms. Not indexed.
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Recenzie',
  robots: { index: false, follow: false },
};

export default function LakeReviewFormPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ReviewFormSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const editing = param(sp, 'editare') === '1';
  // A booking only matters when adding (fish passes it to AddReviewForm only), but it is kept in
  // every mode: an edit link with no review to edit is replaced by the add mode, which needs it.
  const booking = param(sp, 'rezervare');
  const viewer = await requireViewer(routes.lakeReview(id, { editare: editing, rezervare: booking }));
  const lake = await readLake(id);
  if (lake === 'missing') notFound();
  return (
    <>
      <SetBreadcrumb
        trail={[
          { label: 'Bălți', href: routes.lakes() },
          ...(lake ? [{ label: lake.name, href: routes.lake(id) }, { label: 'Recenzii', href: routes.lakeReviews(id) }] : []),
          { label: editing ? 'Editează recenzia' : 'Adaugă o recenzie' },
        ]}
      />
      <ReviewFormScreen lakeId={id} editing={editing} booking={booking} viewerId={viewer.documentId} lake={lake} />
    </>
  );
}

/**
 * The lake's summary, or null when the public read failed: the form only needs the lake's id, so a
 * failed read hides the summary (owner rule 4) instead of blocking the review.
 */
async function readLake(id: string): Promise<LakeSummary | null | 'missing'> {
  try {
    const load = await loadLake(id);
    if (load.kind === 'missing') return 'missing';
    const { lake } = load;
    const img = lake.images[0];
    const meta = lake.reviewsMeta;
    return {
      documentId: lake.documentId,
      name: lake.name,
      photo: img ? img.mediumUrl || img.url || img.smallUrl || null : null,
      location: lakeLocationLine(lake),
      rating:
        meta && meta.count > 0
          ? { overall: meta.overall ?? (meta.quality + meta.facilities + meta.atmosphere) / 3, count: meta.count }
          : null,
    };
  } catch {
    return null;
  }
}
