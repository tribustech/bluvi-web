'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import type { AdminRoles } from '@/components/nav/items';
import type { TopBarViewer } from '@/components/nav/TopBar';
import { DemoTopBar } from './DemoTopBar';
import { DEMO_PATH, parseDemoState, StateSwitcher } from './StateSwitcher';

const SIGNED_OUT: TopBarViewer = { status: 'out', signInHref: `/intra?next=${encodeURIComponent(DEMO_PATH)}` };

/**
 * The demo's shell — top bar + state band — owned by the LAYOUT, so it survives the route's error
 * boundary (a render crash keeps the viewer's avatar, bell and «Administrare»; it never looks like
 * a logout). The current state comes from the URL: `?state=signed-out` / `gate` force the
 * signed-out bar, as the page forces the signed-out list.
 *
 * An «unknown» viewer (the server's session read ran over its budget while a session cookie was
 * there) is read again once on its own — a server refresh, by which time the CMS has usually caught
 * up — and the bar's unknown slot retries on demand. It is never shown as signed out.
 */
export function DemoChrome({ viewer, roles }: { viewer: TopBarViewer; roles: AdminRoles | null }) {
  const state = parseDemoState(useSearchParams().get('state') ?? undefined);
  const forcedOut = state === 'signed-out' || state === 'gate';
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const unknown = viewer.status === 'unknown' && !forcedOut;
  const reread = useRef(false);
  useEffect(() => {
    if (!unknown || reread.current) return;
    reread.current = true;
    startRetry(() => router.refresh());
  }, [unknown, router]);
  return (
    <>
      <DemoTopBar
        viewer={forcedOut ? SIGNED_OUT : viewer}
        roles={forcedOut ? null : roles}
        onRetry={unknown ? () => startRetry(() => router.refresh()) : undefined}
        retrying={retrying}
      />
      <StateSwitcher current={state} />
    </>
  );
}
