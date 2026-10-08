import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { JOIN_TITLE, JoinScreen, JoinScreenLoading } from './_join/JoinScreen';

/*
 * /partide/intra — «Alătură-te unei partide» (parity partide.intra, T6).
 * fish: app/(app)/partide/join/index.tsx (+ helpers/partidaJoinError.ts, domain/hooks.ts useJoinPartida).
 *
 * Signed in only (c1, fish D6 <Redirect href="/sign-in">): no cookie → proxy.ts answers a real 307
 * to /intra?next=/partide/intra; a dead cookie → requireViewer's redirect inside the Suspense
 * boundary (Cache Components: the static shell is the loading page). The join itself is a
 * per-user write through /api/cms (./_join/JoinForm). Not indexed.
 *
 * The invite link with the code filled (/partide/intra/[cod], partide.intra-cod) is a deeper
 * segment of its own: this page never shadows it.
 */

export const metadata: Metadata = {
  title: JOIN_TITLE,
  robots: { index: false, follow: false },
};

export default function JoinPartidaPage() {
  return (
    <Suspense fallback={<JoinScreenLoading />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.partidaJoin());
  return <JoinScreen />;
}
