import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { SessionUnknownError } from '@/lib/server/require-viewer';
import { param, type SearchParams } from '@/lib/search-params';
import { getViewerState } from '../../../_shell/session';
import { RegistrationScreen, RegistrationSkeleton } from './_form/RegistrationForm';

/*
 * /concursuri/[id]/inscriere — register for a competition, or change / leave one's registration
 * (parity participant.register; fish app/(app)/register/[competitionId].tsx). Organizer mode:
 * `?organizator=1&inscriere=<registrationDocumentId>` (fish asOrganizer=1 + registrationId) — the
 * competition's author edits another team's entry; the screen honours it only for the author.
 *
 * Signed in only, per user, not indexed:
 *  - no session cookie → proxy.ts answers 307 /intra?next=<path+query> before rendering;
 *  - a cookie the CMS refuses → fish's signed-out screen (c2) with «Intră în cont» back here — not
 *    requireViewer's redirect: the gate is the page's own state, as in fish;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * Everything else (the competition with its registrations, the profile, the statute) is read in the
 * browser through /api/cms: the registrations decide what the form edits and must be fresh.
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Înscriere',
  robots: { index: false, follow: false },
};

export default function RegistrationPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<RegistrationSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const organizerRequested = param(sp, 'organizator') === '1';
  const registrationId = param(sp, 'inscriere') ?? null;
  const state = await getViewerState();
  if (state && 'status' in state) throw new SessionUnknownError();
  return (
    <RegistrationScreen
      competitionId={id}
      organizerRequested={organizerRequested}
      registrationId={registrationId}
      viewer={state ? { documentId: state.documentId, username: state.username } : null}
      next={routes.competitionRegister(id, {
        organizator: organizerRequested,
        inscriere: registrationId ?? undefined,
      })}
    />
  );
}
