import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { EditProfileSkeleton } from './_components/EditProfileFrame';
import { EditProfileScreen } from './_components/EditProfileScreen';

export const metadata: Metadata = {
  title: 'Editează profilul',
  robots: { index: false, follow: false },
};

/**
 * /setari/profil — account.edit-profile (T6). Signed in only: the gate awaits the session inside
 * the Suspense boundary (Cache Components), so the static shell is the form's skeleton and a
 * signed-out visitor is redirected to /intra?next=/setari/profil.
 */
export default function EditProfilePage() {
  return (
    <Suspense fallback={<EditProfileSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  const viewer = await requireViewer(routes.editProfile());
  return <EditProfileScreen viewerId={viewer.documentId} />;
}
