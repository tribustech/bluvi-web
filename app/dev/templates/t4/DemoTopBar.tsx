'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Viewer } from '@/lib/server/viewer';
import { SiteTopBar } from '../../../(site)/_shell/SiteTopBar';
import { ViewerProvider } from '../../../(site)/_shell/viewer-context';

/** A settled «signed out» session, created once (React's `use` needs a stable promise). */
const SIGNED_OUT: Promise<Viewer | null> = Promise.resolve(null);

/**
 * The product's top bar over the demo. `?state=signed-out` forces the signed-out bar («Intră»,
 * no Administrare) by giving the bar a signed-out session of its own; every other state shows the
 * real session. The query string is read behind its own boundary, so the bar never waits on it.
 */
export function DemoTopBar() {
  return (
    <Suspense fallback={<SiteTopBar />}>
      <Forced />
    </Suspense>
  );
}

function Forced() {
  const forcedOut = useSearchParams()?.get('state') === 'signed-out';
  if (!forcedOut) return <SiteTopBar />;
  return (
    <ViewerProvider viewer={SIGNED_OUT}>
      <SiteTopBar />
    </ViewerProvider>
  );
}
