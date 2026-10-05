'use client';

import { adminLinks, type AdminRoles } from '@/components/nav/items';
import { TopBar, type TopBarViewer } from '@/components/nav/TopBar';

/**
 * The real top bar over the demo. Client-side because the Administrare links carry icon
 * components, which cannot cross the server → client boundary; the server passes plain roles.
 */
export function DemoTopBar({
  viewer,
  roles,
  onRetry,
  retrying,
}: {
  viewer: TopBarViewer;
  roles: AdminRoles | null;
  /** Unknown session: re-read it. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <TopBar
      viewer={viewer}
      onRetry={onRetry}
      retrying={retrying}
      active="concursuri"
      activeCurrent="page"
      admin={roles ? adminLinks(roles) : []}
      className="sticky top-0 z-sticky"
    />
  );
}
