import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getViewerState } from '@/app/(site)/_shell/session';
import { routes } from '@/lib/routes';
import { getSessionToken } from '@/lib/server/session';
import { DisclaimerSessionGate } from './_components/DisclaimerGates';
import { TeamDisclaimerScreen } from './_components/TeamDisclaimerScreen';
import { TeamDisclaimerSkeleton } from './_components/TeamDisclaimerSkeleton';

/*
 * /concursuri/[id]/inscriere/echipa — «Câteva lucruri de menționat» before a NEW registration in a
 * team competition (parity participant.team-disclaimer, T4 single step). fish
 * app/(app)/register/team-competition-disclaimer.tsx, reached from the competition page's
 * «Înscrie-te» (fish NormalUserSheetItems handleRegisterPress; web: core registrationAction
 * `target: 'teamDisclaimer'`).
 *
 * Signed in only. No cookie: the proxy answers a 307 to /intra?next= before rendering (register's
 * /concursuri/:id/inscriere/:path* entry). Inside the Suspense boundary (Cache Components: the
 * session is request-time data) the session is read once more:
 *  - no cookie (the proxy was bypassed): the same redirect;
 *  - a cookie the CMS refused (dead / revoked): the sign-in gate in the page's own frame, coming
 *    back here — the visitor still sees where the link was taking them;
 *  - unknown (a cookie, the CMS did not answer): «Serverul nu răspunde» with a retry (owner rule 4:
 *    an unknown session is never treated as signed out).
 * The competition (name, type, the viewer's registration) is read in the browser (core
 * competitionQuery: the shared core + /my-status through /api/cms). Not indexed.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: 'Înscriere în echipă',
  robots: { index: false, follow: false },
};

export default function TeamDisclaimerPage({ params }: Props) {
  return (
    <Suspense fallback={<TeamDisclaimerSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const here = routes.competitionTeamDisclaimer(id);
  const state = await getViewerState();
  if (state === null) {
    if (!(await getSessionToken())) redirect(routes.signIn(here));
    return <DisclaimerSessionGate kind="dead" competitionId={id} />;
  }
  if ('status' in state) return <DisclaimerSessionGate kind="unknown" competitionId={id} />;
  return <TeamDisclaimerScreen competitionId={id} viewerId={state.documentId} />;
}
