import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrganizerRoleGate } from '@/components/organizer/OrganizerRoleGate';
import { routes, safeReturnPath } from '@/lib/routes';
import { requireOrganizer } from '@/lib/server/require-organizer';
import { param, type SearchParams } from '@/lib/search-params';
import { isWizardStep } from '../../../_wizard/stepDefs';
import { WizardScreen } from '../../../_wizard/WizardScreen';
import { WizardSkeleton } from '../../../_wizard/WizardSkeleton';

/*
 * /organizator/concursuri/nou/[pas] — the create-competition wizard (parity organizer.wizard; fish
 * app/(app)/create-competition/step-*). `pas`: detalii · configurare · clasament · lac-si-sectoare ·
 * standuri · revizuire (anything else is a 404). `?ciorna=<draftId>` reopens a saved draft,
 * `?inapoi=<path>` is fish's returnTo (kept only when same-site).
 *
 * Organizer only, per user, not indexed (organizer.b.signed-out-gate / role-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=<path+query>;
 *  - a cookie the CMS refuses → the same sign-in redirect (requireOrganizer);
 *  - the CMS cannot say → SessionUnknownError → ./error.tsx («Serverul nu răspunde», retry);
 *  - signed in without the Organizer role → OrganizerRoleGate, no organizer read.
 * Everything else (the draft, its lake, every write) runs in the browser through /api/cms.
 */

type Props = {
  params: Promise<{ pas: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Competiție nouă',
  robots: { index: false, follow: false },
};

export default function NewCompetitionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<WizardSkeleton eyebrow="Competiție nouă" />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { pas } = await params;
  if (!isWizardStep(pas)) notFound();
  const sp = await searchParams;
  const draftId = param(sp, 'ciorna') ?? null;
  const returnTo = safeReturnPath(param(sp, 'inapoi'));
  const gate = await requireOrganizer(routes.organizerCompetitionNew(pas, { ciorna: draftId ?? undefined, inapoi: returnTo ?? undefined }));
  if (!gate.allowed) return <OrganizerRoleGate title="Competiție nouă" />;
  return <WizardScreen competitionId={null} draftId={draftId} returnTo={returnTo} initialStep={pas} />;
}
