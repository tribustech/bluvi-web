import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { CompleteProfileSkeleton } from './_components/CompleteProfileFrame';
import { CompleteProfileScreen } from './_components/CompleteProfileScreen';

export const metadata: Metadata = {
  title: 'Completează profilul',
  robots: { index: false, follow: false },
};

/**
 * /profil/completeaza — account.complete-profile (T6). Signed in only: the gate awaits the session
 * inside the Suspense boundary, so the static shell is the form's skeleton and a signed-out visitor
 * is redirected to /intra?next=/profil/completeaza (proxy.ts answers the cookie-less case with a 307).
 */
export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<CompleteProfileSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.completeProfile());
  return <CompleteProfileScreen />;
}
