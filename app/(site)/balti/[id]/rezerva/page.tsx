import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import type { SearchParams } from '@/lib/search-params';
import { e2eFaultsEnabled, e2eFaultStore } from '../_components/e2e-faults';
import { loadLake } from '../_components/load';
import { flowQuery, readFlowParams } from './_flow/params';
import { BookingGridScreen, type GridLake } from './_grid/BookingGridScreen';
import { BookingGridFallback } from './_grid/BookingGridFallback';

/*
 * /balti/[id]/rezerva — step 1 of booking a lake (parity booking.rezerva-grila, T4): pick a stand
 * and an interval on the availability grid. fish: app/(app)/book-lake/[lakeId]/{_layout,index}.tsx.
 *
 * Signed in only (booking.b.sign-in-gate, c1): the gate awaits the session inside the Suspense
 * boundary (Cache Components — the static shell is the grid's skeleton) and a signed-out visitor is
 * redirected to /intra?next=<this page with its selection>. Not indexed.
 *
 * Data: the lake's facts (name, first contact phone, payment mode, deposit, checkout buffer) come
 * from the cached public lake (`/feed/lakes/:id`, load.ts). The availability is LIVE and per visit:
 * read in the browser through /api/cms (_flow/hooks.ts), never cached, never in the HTML (c6, c7).
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Rezervă un stand',
  robots: { index: false, follow: false },
};

export default function BookLakePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<BookingGridFallback />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  // /intra returns here with the selection the visitor had (a shared link, a reload while signed out).
  const q = flowQuery(readFlowParams(await searchParams).selection);
  await requireViewer(`${routes.lakeBooking(id)}${q ? `?${q}` : ''}`);
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const { lake } = load;
  const facts: GridLake = {
    documentId: lake.documentId,
    name: lake.name,
    phone: lake.contact[0]?.phone || null,
    paymentMode: lake.paymentMode,
    depositPercent: lake.depositPercent,
    // Development-only e2e reshape (the local CMS has no deposit lake): `deposit-30` through the lake's
    // fault switch (../e2e-fault). A no-op in production builds.
    ...(e2eFaultsEnabled() && e2eFaultStore().get(id)?.has('deposit-30') ? { paymentMode: 'deposit', depositPercent: 30 } : {}),
    checkoutBufferMinutes: lake.checkoutBufferMinutes,
  };
  return <BookingGridScreen lake={facts} />;
}
