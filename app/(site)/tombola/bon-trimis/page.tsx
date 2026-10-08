import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { raffleCopy } from '../_shared/copy';
import { ReceiptSubmittedScreen, ReceiptSubmittedSkeleton } from './_components/ReceiptSubmittedScreen';

/*
 * /tombola/bon-trimis — «Bon încărcat» (parity participant.raffle-receipt-submitted, T6).
 * fish: app/(app)/raffle/receipt-submitted.tsx. An orphan: only /tombola/bon sends the viewer here,
 * after a successful upload; nothing else links to it.
 *
 * Signed in only: no cookie → proxy.ts answers a 307 to /intra?next=/tombola/bon-trimis; a dead
 * cookie → requireViewer's redirect inside the Suspense boundary. The participation is per viewer
 * and read in the browser through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: raffleCopy.receiptSubmitted.title,
  robots: { index: false, follow: false },
};

export default function RaffleReceiptSubmittedPage() {
  return (
    <Suspense fallback={<ReceiptSubmittedSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.raffleReceiptSubmitted());
  return <ReceiptSubmittedScreen />;
}
