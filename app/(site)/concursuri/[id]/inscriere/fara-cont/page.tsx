import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getViewerState } from '@/app/(site)/_shell/session';
import { routes } from '@/lib/routes';
import { SessionUnknownError } from '@/lib/server/require-viewer';
import { param, type SearchParams } from '@/lib/search-params';
import { GuestScreen, GuestSkeleton } from './_form/GuestForm';

/*
 * /concursuri/[id]/inscriere/fara-cont — «Adaugă participanți fără cont» (parity
 * participant.register-guests, T4 one step; fish app/(app)/register/register-guests.tsx). Edit:
 * `?inscriere=<registrationDocumentId>` («Editează participanți»), `&doarEchipa=1` edits only the
 * team name (fish membersOnly). Edit mode reads the entry from the competition's registrations
 * instead of fish's guestName/teamName URL params: the same values, and they survive a reload (c8).
 *
 * Organizer only, per user, not indexed:
 *  - no session cookie → proxy.ts answers 307 /intra?next=<path+query> (the /inscriere/:path* entry);
 *  - a cookie the CMS refuses → the same sign-in redirect (there is nothing to show a guest here);
 *  - the CMS cannot say → SessionUnknownError → ../error.tsx («Serverul nu răspunde», retry).
 * The competition and the viewer's statute are read in the browser through /api/cms; a viewer who
 * does not author the competition is sent back to its page (rule 4: never a form they cannot submit).
 * Reached by URL in M5; the organizer's entry points (menu, «Editează» on a guest row) come with M6.
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Participanți fără cont',
  robots: { index: false, follow: false },
};

export default function GuestRegistrationPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<GuestSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const registrationId = param(sp, 'inscriere') || null;
  const membersOnly = Boolean(registrationId) && param(sp, 'doarEchipa') === '1';
  const state = await getViewerState();
  if (state && 'status' in state) throw new SessionUnknownError();
  if (!state) redirect(routes.signIn(routes.competitionRegisterGuests(id, { inscriere: registrationId ?? undefined, doarEchipa: membersOnly })));
  return <GuestScreen competitionId={id} registrationId={registrationId} membersOnly={membersOnly} />;
}
