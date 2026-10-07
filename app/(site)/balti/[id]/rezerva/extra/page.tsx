import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import type { SearchParams } from '@/lib/search-params';
import { loadLake } from '../../_components/load';
import { readFlowParams } from '../_flow/params';
import { ExtrasScreen } from './ExtrasScreen';
import { ExtrasSkeleton } from './ExtrasSkeleton';

/*
 * /balti/[id]/rezerva/extra — step 2 of booking a lake (parity booking.rezerva-extra, T4): what to
 * add to the tour (a cabin, a caravan). fish: app/(app)/book-lake/[lakeId]/extras.tsx.
 *
 * Signed in only: the gate awaits the session inside the Suspense boundary (Cache Components — the
 * static shell is the step's skeleton); a signed-out visitor goes to /intra?next=<this page with its
 * selection and extras>. Not indexed. The selection guard runs in the browser, against the LIVE
 * availability (ExtrasScreen); the lake's name and checkout buffer come from the cached public lake.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Extra · Rezervă un stand',
  robots: { index: false, follow: false },
};

export default function BookLakeExtrasPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ExtrasSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const { selection, extras } = readFlowParams(await searchParams);
  // /intra returns here with the step's state; without a selection there is no step to return to.
  await requireViewer(selection ? routes.lakeBookingExtras(id, { ...selection, extras }) : routes.lakeBooking(id));
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const { lake } = load;
  return <ExtrasScreen lake={{ documentId: lake.documentId, name: lake.name, checkoutBufferMinutes: lake.checkoutBufferMinutes }} />;
}
