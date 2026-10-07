import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { SettingsScreen } from './_components/SettingsScreen';
import { SettingsSkeleton } from './_components/SettingsSkeleton';

export const metadata: Metadata = {
  title: 'Setări',
  robots: { index: false, follow: false },
};

/**
 * /setari — account.settings (fish app/(app)/settings.tsx). Signed in only: the gate awaits the
 * session inside the Suspense boundary (Cache Components), so the static shell is the hub's
 * skeleton and a signed-out visitor is redirected to /intra?next=%2Fsetari (proxy.ts answers a
 * cookie-less request with a 307 before rendering). The profile is per user: read in the browser
 * through /api/cms.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.settings());
  return <SettingsScreen />;
}
