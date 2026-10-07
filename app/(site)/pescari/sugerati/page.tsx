import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { SuggestedGrid, SuggestedPageLoading } from './_components/SuggestedGrid';

/*
 * /pescari/sugerati — «Sugestii pentru tine», every suggested angler (parity account.suggested, T1).
 * fish: app/(app)/anglers/suggested.tsx; reached from the Home rail's «Vezi toate»
 * (account.b.suggested-rail) and fish's /anglers/suggested links (next.config.ts redirect).
 *
 * The static segment wins over the sibling /pescari/[id] (App Router: a static segment matches
 * before a dynamic one), so «sugerati» is never read as an angler id.
 *
 * Signed in only (c1): no cookie → proxy.ts answers a real 307 to /intra?next=/pescari/sugerati;
 * a dead cookie → requireViewer's redirect inside the Suspense boundary (Cache Components: the
 * static shell is the loading page). The suggestions are per viewer, so they load in the browser
 * through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: 'Sugestii pentru tine',
  robots: { index: false, follow: false },
};

export default function SuggestedAnglersPage() {
  return (
    <Suspense fallback={<SuggestedPageLoading />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.suggestedAnglers());
  return <SuggestedGrid />;
}
