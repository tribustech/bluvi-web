import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { NotificationsScreen } from './_components/NotificationsList';
import { NotificationsSkeleton } from './_components/NotificationsSkeleton';

export const metadata: Metadata = {
  title: 'Notificări',
  robots: { index: false, follow: false },
};

/**
 * /notificari — account.notifications (T1, one list, no filters). Signed in only
 * (account.notifications.c12): the gate awaits the session inside the Suspense boundary (Cache
 * Components), so the static shell is the list's skeleton and a signed-out visitor is redirected to
 * /intra?next=/notificari. The list itself is per user: read in the browser through /api/cms.
 * Web push is out of scope (global.push web_replacement: this page + the top bar's unread dot).
 */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.notifications());
  return <NotificationsScreen />;
}
