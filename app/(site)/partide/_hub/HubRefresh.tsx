'use client';

import { Suspense, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardRefresh } from '@/components/templates/T5';
import { createBrowserTransport } from '@/lib/client/transport';
import { refreshPartideHub, usePartideViewer } from './activePartida';

/**
 * fish pull-to-refresh on the Partide tab (parity partide.comunitate.c24), as the T5 header's
 * refresh control: refetch the own-sessions list (signed in) and invalidate every community query.
 * While the session is unread the same control refreshes the community alone.
 */
export function HubRefresh() {
  return (
    <Suspense fallback={<Refresh uid={null} />}>
      <RefreshForViewer />
    </Suspense>
  );
}

function RefreshForViewer() {
  const viewer = usePartideViewer();
  return <Refresh uid={viewer.kind === 'viewer' ? viewer.uid : null} />;
}

function Refresh({ uid }: { uid: string | null }) {
  const qc = useQueryClient();
  const t = useMemo(() => createBrowserTransport(), []);
  return <DashboardRefresh onRefresh={() => refreshPartideHub(qc, t, uid)} />;
}
