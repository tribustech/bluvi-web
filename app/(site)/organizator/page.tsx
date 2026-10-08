import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrganizerRoleGate } from '@/components/organizer/OrganizerRoleGate';
import { routes } from '@/lib/routes';
import { requireOrganizer } from '@/lib/server/require-organizer';
import { SetBreadcrumb } from '../_shell/SiteHeader';
import { PANEL_TRAIL } from './_panel/frame';
import { OrganizerPanel } from './_panel/OrganizerPanel';
import { PanelSkeleton } from './_panel/PanelSkeleton';

export const metadata: Metadata = {
  title: 'Panou organizator',
  robots: { index: false, follow: false },
};

/**
 * /organizator — organizer.panel (T5). Signed in only: proxy.ts answers a cookie-less request with
 * a 307 to /intra?next=/organizator (organizer.b.signed-out-gate); requireOrganizer, awaited inside
 * the Suspense boundary (Cache Components), handles a dead session and the role (organizer.b.role-gate:
 * a viewer who is not an Organizer gets the neutral gate, and no organizer read is made). Everything
 * on the panel is per user, read in the browser through /api/cms — never cached, never indexed.
 */
export default function OrganizerPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Gated />
    </Suspense>
  );
}

async function Gated() {
  const gate = await requireOrganizer(routes.organizer());
  if (!gate.allowed) {
    return (
      <>
        <SetBreadcrumb trail={PANEL_TRAIL} />
        <OrganizerRoleGate />
      </>
    );
  }
  return <OrganizerPanel />;
}
