import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import type { SearchParams } from '@/lib/search-params';
import { e2eFaultsEnabled } from '../../_components/e2e-faults';
import { loadLake } from '../../_components/load';
import { readFlowParams, stepHref } from '../_flow/params';
import type { ReviewLake } from './model';
import { ReviewSkeleton } from './ReviewSkeleton';
import { ReviewStep } from './ReviewStep';

/*
 * /balti/[id]/rezerva/confirmare — step 3 of booking a lake (parity booking.rezerva-confirmare, T4):
 * the server's price, the contact details, the confirmation. fish app/(app)/book-lake/[lakeId]/review.tsx.
 *
 * Guard (c1): a URL without a selection is sent to the grid before anything renders — a real 307
 * when it resolves before the first byte. A stand the lake no longer has is judged in the browser
 * once the live availability is read (ReviewStep), still before the step renders. Signed in only
 * (booking.b.sign-in-gate): signed out → /intra?next=<this step with its selection>. Not indexed.
 *
 * Data: the lake's facts (name, county, payment / confirmation mode, deposit, checkout buffer,
 * regulation, cancellation policy) from the cached public lake (`/feed/lakes/:id`, load.ts); the
 * availability (the stand's name), the quote and the profile are read in the browser through
 * /api/cms (live / per user, never cached).
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Confirmă rezervarea',
  robots: { index: false, follow: false },
};

export default function BookingReviewPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Development-only reshapes of the lake for the e2e (the local CMS has one offline, manual lake). */
const E2E_COOKIE = 'bluvi-e2e-booking-lake';

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const flow = readFlowParams(await searchParams);
  if (!flow.selection) redirect(stepHref(id, 'grid', flow));
  await requireViewer(stepHref(id, 'review', flow));
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const { lake } = load;
  const facts: ReviewLake = {
    documentId: lake.documentId,
    name: lake.name,
    county: lake.county || lake.countyRef?.name || null,
    paymentMode: lake.paymentMode,
    depositPercent: lake.depositPercent,
    confirmationMode: lake.confirmationMode,
    checkoutBufferMinutes: lake.checkoutBufferMinutes,
    regulationUrl: lake.regulationUrl,
    cancellationPolicy: lake.cancellationPolicy,
    ...(e2eFaultsEnabled() ? e2eReshape((await cookies()).get(E2E_COOKIE)?.value) : {}),
  };
  return <ReviewStep lake={facts} />;
}

/**
 * A JSON object of ReviewLake fields from the e2e's cookie (per browser context, so parallel specs
 * on the same lake never see each other's lake). A no-op in production builds.
 */
function e2eReshape(raw: string | undefined): Partial<ReviewLake> {
  if (!raw) return {};
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ReviewLake>;
    return typeof v === 'object' && v ? v : {};
  } catch {
    return {};
  }
}
