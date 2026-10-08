import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../_organizer/metadata';
import { PenaltiesScreen } from './_hub/PenaltiesScreen';
import { PenaltiesSkeleton } from './_hub/PenaltiesSkeleton';

/*
 * /concursuri/[id]/penalizari — the penalties hub (parity organizer.penalties; fish
 * app/(app)/penalties/[competitionId]/index.tsx). Every signed-in viewer may read it — it is where a
 * PENALTY notification lands for the penalised team — and the author or a referee applies and
 * revokes. Per user, never indexed (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/penalizari;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition, the statute and the ranking are read in the browser through /api/cms.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata = managementMetadata('Penalizări');

export default function PenaltiesPage({ params }: Props) {
  return (
    <Suspense fallback={<PenaltiesSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(routes.competitionPenalties(id));
  return <PenaltiesScreen competitionId={id} viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }} />;
}
