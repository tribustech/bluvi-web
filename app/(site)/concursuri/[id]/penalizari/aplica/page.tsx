import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../../_organizer/metadata';
import { ApplyForm } from './_apply/ApplyForm';
import { ApplySkeleton } from './_apply/ApplySkeleton';

/*
 * /concursuri/[id]/penalizari/aplica?inscriere=[registrationId] — «Aplică penalizare» (parity
 * organizer.penalties-apply; fish app/(app)/penalties/[competitionId]/apply.tsx). Signed in only, per
 * user, never indexed (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=<this path + query>;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say → SessionUnknownError → error.tsx.
 * The competition, the statute and the registrations are read in the browser through /api/cms
 * (ApplyForm), so the shell is static and the data always the viewer's fresh view.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ inscriere?: string | string[] }> };

export const metadata = managementMetadata('Aplică penalizare');

export default function ApplyPenaltyPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ApplySkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(query.inscriere) ? query.inscriere[0] : query.inscriere;
  const registrationId = raw?.trim() || null;
  const viewer = await requireViewer(
    registrationId ? routes.competitionPenaltiesApply(id, registrationId) : `${routes.competitionPenalties(id)}/aplica`,
  );
  return (
    <ApplyForm
      competitionId={id}
      registrationId={registrationId}
      viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }}
    />
  );
}
