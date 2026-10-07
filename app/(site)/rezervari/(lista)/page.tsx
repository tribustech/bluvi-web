import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { MyBookingsSkeleton } from '../_components/frame';
import { MyBookingsScreen } from '../_components/MyBookingsScreen';
import { myBookingsQuery, SUB_PARAM, TAB_PARAM } from '../_components/url';

export const metadata: Metadata = {
  title: 'Rezervările mele',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /rezervari — booking.rezervarile-mele (T1). Signed in only (booking.b.sign-in-gate): proxy.ts
 * answers a cookie-less request with a 307 to /intra?next=…; requireViewer, awaited inside the
 * Suspense boundary (Cache Components), handles a dead or revoked session. The static shell is the
 * list's skeleton; the bookings themselves are per user, read in the browser through /api/cms.
 */
export default function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<MyBookingsSkeleton />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Gated({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = one(sp[TAB_PARAM]);
  const filtru = one(sp[SUB_PARAM]);
  await requireViewer(`${routes.myBookings()}${myBookingsQuery(tab, filtru)}`);
  return <MyBookingsScreen initialTab={tab} initialSub={filtru} />;
}
