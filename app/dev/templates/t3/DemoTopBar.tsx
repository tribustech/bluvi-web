'use client';

import { Suspense, use } from 'react';
import { adminLinks } from '@/components/nav/items';
import { TopBar, type TopBarViewer } from '@/components/nav/TopBar';
import type { Viewer } from '@/lib/server/viewer';

/** The session as the demo reads it: a viewer, signed out, or not known in time (bounded read). */
export type DemoViewer = Viewer | null | 'unknown';

type Props = {
  /** The bounded session read, not awaited on the server; null = not started yet (the static shell). */
  viewer: Promise<DemoViewer> | null;
  active?: string;
  signIn: string;
};

/**
 * The real top bar over the demo, rendered before the session is known (as SiteTopBar): a neutral
 * avatar slot while the read runs, then the resolved bar — so the landmarks and the bar never wait
 * for the CMS and never push the page down when it answers. The Administrare links carry icon
 * components, which cannot cross from a Server Component, so they are built here, in the browser.
 */
export function DemoTopBar({ viewer, active, signIn }: Props) {
  const pending = <Bar viewer={{ status: 'pending' }} active={active} />;
  if (!viewer) return pending;
  return (
    <Suspense fallback={pending}>
      <Resolved viewer={viewer} active={active} signIn={signIn} />
    </Suspense>
  );
}

function Resolved({ viewer, active, signIn }: { viewer: Promise<DemoViewer>; active?: string; signIn: string }) {
  const v = use(viewer);
  if (v === 'unknown') return <Bar viewer={{ status: 'unknown' }} active={active} />;
  const bar: TopBarViewer = v ? { status: 'in', name: v.username, avatarUrl: v.avatarUrl } : { status: 'out', signInHref: signIn };
  return <Bar viewer={bar} active={active} admin={v ? adminLinks(v) : []} />;
}

function Bar({ viewer, active, admin = [] }: { viewer: TopBarViewer; active?: string; admin?: ReturnType<typeof adminLinks> }) {
  return <TopBar viewer={viewer} active={active} activeCurrent="true" admin={admin} className="sticky top-0 z-sticky" />;
}
