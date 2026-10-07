import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { BookingDetailScreen } from './_components/BookingDetailScreen';
import { BookingDetailSkeleton } from './_components/frame';

export const metadata: Metadata = {
  title: 'Rezervare',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/** The breadcrumb from 768 (the URL alone only knows «Acasă»). */
const BOOKING_TRAIL = [{ label: 'Rezervările mele', href: routes.myBookings() }, { label: 'Rezervare' }];

/** A CMS documentId: letters, digits, `-` / `_` (anything else cannot be a booking). */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * /rezervari/[id] — booking.rezervare (T3 without tabs). Signed in only (booking.b.sign-in-gate):
 * proxy.ts answers a cookie-less request with a 307 to /intra?next=/rezervari/{id}, and requireViewer
 * (awaited inside the Suspense boundary, Cache Components) handles a dead or revoked session — so a
 * notification link opened while signed out lands here after sign-in (c14). The booking itself is
 * per user, read in the browser through /api/cms. Not indexed. Legacy fish links /bookings/{id}
 * redirect here (next.config.ts).
 */
export default function BookingPage({ params }: Props) {
  return (
    <>
      <SetBreadcrumb trail={BOOKING_TRAIL} />
      <Suspense fallback={<BookingDetailSkeleton />}>
        <Gated params={params} />
      </Suspense>
    </>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(routes.booking(id));
  if (!ID.test(id)) notFound();
  return <BookingDetailScreen id={id} viewerId={viewer.documentId} />;
}
