import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SessionUnknownError } from '@/lib/server/require-viewer';
import { param, type SearchParams } from '@/lib/search-params';
import { routes } from '@/lib/routes';
import { getViewerState } from '../../../_shell/session';
import { loadCompetition } from '../_components/load';
import { ChatScreen } from './_chat/ChatScreen';
import { ChatSignedOut, ChatSkeleton } from './_chat/ChatStates';
import { chatFactsOf } from './_chat/facts';
import { roomFromParam, tabParamOf } from './_live/lastTab';

/*
 * /concursuri/[id]/chat?tab=general|participanti — the competition chat (parity participant.chat;
 * fish app/(app)/competitions/[competitionId]/chat). Signed in only, per user, never indexed:
 *  - no session cookie → proxy.ts answers 307 /intra?next=<path+query> before rendering;
 *  - a cookie the CMS refuses → the sign-in gate in the chat's frame, back here after sign-in
 *    (participant.b.chat-signed-out: fish has no gate, its toast over an empty room);
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition's public data is the cached public read (load.ts → lib/server/public-get, purged
 * by the `competition-<id>` tag), so the header has the name and banner at first paint (c1); an
 * unknown id is the competition's 404 (not-found.tsx). A read that failed here (the CMS slow) leaves
 * the header to the browser's own query: bars while it runs, «Chat» if it fails too (fish). Everything live (Firestore, the viewer's follow state and
 * statute, the notification preferences) is read in the browser — the Firebase SDK only in the
 * chat's own on-demand chunk (_live/source.ts).
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Chat concurs',
  robots: { index: false, follow: false },
};

export default function ChatPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const room = roomFromParam(param(sp, 'tab'));
  const [state, load] = await Promise.all([getViewerState(), loadCompetition(id).catch(() => null)]);
  if (state && 'status' in state) throw new SessionUnknownError();
  // An unknown (or deleted) id: the competition's 404, never a chat with Firestore listeners for
  // nothing under bars that would never resolve (owner rule 4).
  if (load?.kind === 'missing') notFound();
  if (!state) return <ChatSignedOut next={routes.competitionChat(id, room ? tabParamOf(room) : undefined)} />;
  const facts = load && (load.kind === 'ok' || load.kind === 'unsupported') ? chatFactsOf(load.competition) : null;
  return (
    <ChatScreen
      competitionId={id}
      viewer={{ documentId: state.documentId, username: state.username, avatarUrl: state.avatarUrl }}
      facts={facts}
    />
  );
}
