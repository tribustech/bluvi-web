import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { FollowedCompetitions } from './_components/FollowedCompetitions';
import { FollowedFrame, FollowedLoading } from './_components/FollowedFrame';

/*
 * /setari/notificari/concursuri — «Concursuri urmărite» (parity account.notification-preferences,
 * T1). fish: app/(app)/notification-preferences.tsx.
 *
 * Signed in only: GET /feed/followed-competitions and the preferences routes are per user. No
 * cookie → proxy.ts answers a 307 to /intra?next=/setari/notificari/concursuri; a dead cookie →
 * requireViewer's redirect inside the Suspense boundary (Cache Components: the static shell is the
 * page's frame with its spinner). The list loads in the browser through /api/cms. Not indexed.
 */

export const metadata: Metadata = {
  title: 'Concursuri urmărite',
  robots: { index: false, follow: false },
};

export default function FollowedCompetitionsPage() {
  return (
    <Suspense
      fallback={
        <FollowedFrame>
          <FollowedLoading />
        </FollowedFrame>
      }
    >
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  await requireViewer(routes.notificationPreferences());
  return <FollowedCompetitions />;
}
