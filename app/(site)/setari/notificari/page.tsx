import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { NotificationSettingsScreen } from './_components/NotificationSettingsScreen';
import { NotificationSettingsSkeleton } from './_components/NotificationSettingsSkeleton';

export const metadata: Metadata = {
  title: 'Setări notificări',
  robots: { index: false, follow: false },
};

/**
 * /setari/notificari — account.notification-settings (fish app/(app)/notification-settings.tsx).
 * Signed in only: the gate awaits the session inside the Suspense boundary (Cache Components), so the
 * static shell is the cards' skeleton and a signed-out visitor is redirected to
 * /intra?next=/setari/notificari. The profile is per user: read in the browser through /api/cms.
 */
export default function NotificationSettingsPage() {
  return (
    <Suspense fallback={<NotificationSettingsSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.notificationSettings());
  return <NotificationSettingsScreen />;
}
