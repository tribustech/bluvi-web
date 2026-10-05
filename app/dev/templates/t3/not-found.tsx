import { connection } from 'next/server';
import { Suspense } from 'react';
import { SHELL_MAX } from '@/components/nav/shell';
import { DetailNotFound } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { bounded } from './data';
import { DemoTopBar, type DemoViewer } from './DemoTopBar';
import { readViewerState } from './viewer';

/*
 * The T3 demo's not-found: what a T3 route renders when its main read answers 404 (`notFound()` in
 * page.tsx — data.ts isNotFound), instead of the retryable page error. The demo's screen lives in
 * the query string, which this file cannot read, so the copy is the generic one; a real route's
 * not-found names its thing («Balta nu a fost găsită.», ?state=not-found).
 *
 * The same frame as page.tsx: the skip link, the top bar resolved from the same bounded tri-state
 * session read (its account slot pending until it answers — never forever), <main id="continut">.
 */

const SESSION_TIMEOUT_MS = 4000;

export default function T3NotFound() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <a
        href="#continut"
        className="sr-only z-skip rounded-control bg-surface t-body-strong text-accent-ink shadow-e2 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
      >
        Sari la conținut
      </a>
      <Suspense fallback={<DemoTopBar viewer={null} signIn="/intra" />}>
        <TopBarWithSession />
      </Suspense>
      <main id="continut" tabIndex={-1} className={cn('mx-auto scroll-mt-14 outline-none md:scroll-mt-16', SHELL_MAX)}>
        <DetailNotFound
          title="Pagina nu a fost găsită."
          description="Poate a fost ștearsă sau linkul e greșit."
          href={routes.home()}
          cta="Mergi la Acasă"
        />
      </main>
    </div>
  );
}

async function TopBarWithSession() {
  // Request time only (the session cookie): the static shell keeps the pending bar above.
  await connection();
  const viewer = bounded<DemoViewer>(readViewerState().catch(() => 'unknown' as const), SESSION_TIMEOUT_MS, 'unknown');
  return <DemoTopBar viewer={viewer} signIn="/intra" />;
}
