import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { raffleCopy } from '../_shared/copy';
import { StatusScreen, StatusSkeleton } from './_components/StatusScreen';

/*
 * /tombola/sansele-mele — «Șansele mele» (parity participant.raffle-status, T6).
 * fish: app/(app)/raffle/status.tsx — an orphan there (no screen navigates to it, c1). The web
 * builds it for parity, reachable by URL only: nothing links here until the owner decides.
 *
 * Signed in only: no cookie → proxy.ts answers a 307 to /intra?next=/tombola/sansele-mele; a dead
 * cookie → requireViewer's redirect inside the Suspense boundary. Everything on the page is per
 * viewer and read in the browser through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: raffleCopy.status.title,
  robots: { index: false, follow: false },
};

export default function RaffleStatusPage() {
  return (
    <Suspense fallback={<StatusSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.raffleStatus());
  return <StatusScreen />;
}
