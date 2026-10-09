'use client';

import { Suspense } from 'react';
import { AnalyticsLinkListener } from './AnalyticsLinkListener';
import { Ga4 } from './Ga4';
import { ScreenViewTracker } from './ScreenViewTracker';

/** The site-wide analytics mount (app/layout.tsx, next to the consent provider). Renders no markup. */
export function Analytics() {
  return (
    <>
      <Ga4 />
      <AnalyticsLinkListener />
      <Suspense fallback={null}>
        <ScreenViewTracker />
      </Suspense>
    </>
  );
}
