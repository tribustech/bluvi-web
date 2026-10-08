import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { CapturileMelePageLoading, CapturileMeleScreen } from './_gallery/CapturileMeleScreen';

/*
 * /partide/capturile-mele — «Capturile mele» (parity docs/parity/areas/partide.yml
 * partide.capturile-mele, T1). fish: app/(app)/partide/capturi.tsx, reached from Ale mele's «Vezi
 * tot» rail card.
 *
 * Signed in only: no cookie → proxy.ts answers a real 307 to /intra?next=/partide/capturile-mele;
 * a dead cookie → requireViewer's redirect inside the Suspense boundary (Cache Components: the
 * static shell is the loading page). The catches are the viewer's own (/feed/sessions/mine/catches,
 * which keeps the partide hidden from the profile), read in the browser through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: 'Capturile mele',
  description: 'Toate capturile tale cu fotografie, din partide și concursuri.',
  robots: { index: false, follow: false },
};

export default function CapturileMelePage() {
  return (
    <Suspense fallback={<CapturileMelePageLoading />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.myCatches());
  return <CapturileMeleScreen />;
}
