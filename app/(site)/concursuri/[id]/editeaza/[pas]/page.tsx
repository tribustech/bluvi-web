import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrganizerRoleGate } from '@/components/organizer/OrganizerRoleGate';
import { routes, safeReturnPath } from '@/lib/routes';
import { requireOrganizer } from '@/lib/server/require-organizer';
import { param, type SearchParams } from '@/lib/search-params';
import { isWizardStep } from '../../../../organizator/_wizard/stepDefs';
import { WizardScreen } from '../../../../organizator/_wizard/WizardScreen';
import { WizardSkeleton } from '../../../../organizator/_wizard/WizardSkeleton';

/*
 * /concursuri/[id]/editeaza/[pas] — the create wizard editing a published, not-started competition
 * (parity organizer.wizard, edit mode; fish create-competition with competitionId + returnTo):
 * no auto-save, no delete, «Salvează modificările» instead of publish. `?inapoi=` returns there
 * (same-site only), else to the competition page.
 *
 * Signed in only (proxy.ts 307 / requireOrganizer), Organizer role (OrganizerRoleGate otherwise).
 * The author check and the status are read in the browser (WizardScreen): a viewer who does not
 * author it goes back to the competition page; a started or finished one shows «Nu poți modifica
 * competiția» (organizer.b.cannot-edit-started). The CMS stays the authority (403 for others).
 */

type Props = {
  params: Promise<{ id: string; pas: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Modifică competiția',
  robots: { index: false, follow: false },
};

export default function EditCompetitionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<WizardSkeleton eyebrow="Modifică competiția" />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id, pas } = await params;
  if (!isWizardStep(pas)) notFound();
  const sp = await searchParams;
  const returnTo = safeReturnPath(param(sp, 'inapoi'));
  const gate = await requireOrganizer(routes.competitionEdit(id, pas, { inapoi: returnTo ?? undefined }));
  if (!gate.allowed) return <OrganizerRoleGate title="Modifică competiția" />;
  return <WizardScreen competitionId={id} draftId={null} returnTo={returnTo} initialStep={pas} />;
}
