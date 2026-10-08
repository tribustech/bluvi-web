import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { raffleCopy } from '../_shared/copy';
import { ConfirmationScreen, ConfirmationSkeleton } from './_components/ConfirmationScreen';

/*
 * /tombola/confirmare — «Confirmare participare» (parity participant.raffle-confirmation, T6).
 * fish: app/(app)/raffle/confirmation.tsx.
 *
 * Signed in only: no cookie → proxy.ts answers a 307 to /intra?next=/tombola/confirmare; a dead
 * cookie → requireViewer's redirect inside the Suspense boundary. Everything on the page is per
 * viewer (the participation, the receipt) and read in the browser through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: raffleCopy.confirmation.title,
  robots: { index: false, follow: false },
};

export default function RaffleConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.raffleConfirmation());
  return <ConfirmationScreen />;
}
