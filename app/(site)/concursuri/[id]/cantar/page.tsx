import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../_organizer/metadata';
import { ScaleScreen } from './_stands/ScaleScreen';
import { ScaleSkeleton } from './_stands/ScaleSkeleton';

/*
 * /concursuri/[id]/cantar — the scale's «Alege standul» (parity organizer.scale; fish
 * app/(app)/scale/[competitionId]/index.tsx). Signed in only, per user, never indexed
 * (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/cantar;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition and its allocations are read in the browser through /api/cms (ScaleScreen), so the
 * page shell is static and the data is always the viewer's fresh view.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata = managementMetadata('Cântar — Alege standul');

export default function ScalePage({ params }: Props) {
  return (
    <Suspense fallback={<ScaleSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(routes.competitionScale(id));
  return <ScaleScreen competitionId={id} viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }} />;
}
