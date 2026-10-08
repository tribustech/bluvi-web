import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { IntroScreen, IntroSkeleton } from './_intro/IntroScreen';
import { raffleCopy } from './_shared/copy';

/*
 * /tombola — «Tragere la sorți» (parity participant.raffle-intro, T6).
 * fish: app/(app)/raffle/index.tsx (+ contexts/RaffleContext.tsx, hooks/useRaffle.ts).
 *
 * Signed in only (fish's raffle stack lives under (app)): no cookie → proxy.ts answers a real 307
 * to /intra?next=/tombola; a dead cookie → requireViewer's redirect inside the Suspense boundary.
 * The session, the participation and the profile are per viewer and read in the browser through
 * /api/cms (./_intro/IntroScreen). Not indexed.
 */

export const metadata: Metadata = {
  // From copy.ts, not the client module: a client file's non-component export is a reference here.
  title: raffleCopy.intro.pageTitle,
  robots: { index: false, follow: false },
};

export default function RafflePage() {
  return (
    <Suspense fallback={<IntroSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.raffle());
  return <IntroScreen />;
}
