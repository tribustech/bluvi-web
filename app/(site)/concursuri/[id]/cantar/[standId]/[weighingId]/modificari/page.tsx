import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../../../../_organizer/metadata';
import { RevisionsScreen } from './_revisions/RevisionsScreen';
import { RevisionsSkeleton } from './_revisions/RevisionsSkeleton';

/*
 * /concursuri/[id]/cantar/[standId]/[weighingId]/modificari — a weighing's «Istoric modificări»
 * (parity organizer.scale-revisions; fish app/(app)/scale/[competitionId]/revisions.tsx). Signed in
 * only, per user, never indexed (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=<this path>;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The log is read in the browser through /api/cms (RevisionsScreen): the shell is static and the
 * log always fresh (staleTime 0).
 */

type Props = { params: Promise<{ id: string; standId: string; weighingId: string }> };

export const metadata = managementMetadata('Istoric modificări');

export default function RevisionsPage({ params }: Props) {
  return (
    <Suspense fallback={<RevisionsSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id, standId, weighingId } = await params;
  const viewer = await requireViewer(routes.competitionScaleRevisions(id, standId, weighingId));
  return (
    <RevisionsScreen
      competitionId={id}
      standId={standId}
      weighingId={weighingId}
      viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }}
    />
  );
}
