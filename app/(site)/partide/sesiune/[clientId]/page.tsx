import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { SpectatorSkeleton } from '../../[id]/_spectator/SpectatorSkeleton';
import { ResolveSession } from './ResolveSession';

/*
 * /partide/sesiune/[clientId] — a partidă by its CLIENT id (the Firestore session id), the target of
 * PARTIDA_FINISHED and PARTIDA_AUTO_CLOSE_WARN (parity partide.b.notif-finished-autoclose; fish
 * helpers/getRedirectLocationForNotification.ts:107-116 routes them to /(app)/partide/{sessionId}).
 * The web keys every partidă page on the documentId, so this page only resolves and replaces itself:
 * the live pointer, then the viewer's own list (core findMineListItem) → /partide/[documentId];
 * a loaded list without a match → «Ale mele»; a failed read → the partidă page's error card.
 *
 * Signed in only (the push goes to the owner and the co-op members): proxy.ts answers a cookie-less
 * request with a 307 to /intra?next=…, requireViewer a dead session. Never indexed.
 */

export const metadata: Metadata = {
  title: 'Partidă',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ clientId: string }> };

export async function generateStaticParams() {
  // Per-user ids, unknowable at build: one placeholder for Cache Components' build validation.
  return [{ clientId: '_' }];
}

export default function PartidaSessionPage({ params }: Props) {
  return (
    <Suspense fallback={<SpectatorSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { clientId } = await params;
  await requireViewer(routes.partidaSession(clientId));
  return <ResolveSession clientId={clientId} />;
}
