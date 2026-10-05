import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { getViewer, type Viewer } from '@/lib/server/viewer';
import { BreadcrumbProvider, PageBreadcrumbs } from '../../../(site)/_shell/SiteHeader';
import { SiteTopBar } from '../../../(site)/_shell/SiteTopBar';
import { ToastProvider } from '../../../(site)/_shell/Toast';
import { ViewerProvider, type ShellViewer } from '../../../(site)/_shell/viewer-context';

/** app/(site)/layout.tsx: how long the top bar waits for the session, and the outer bound. */
const SHELL_SESSION_TIMEOUT_MS = 4000;
const LATE_SESSION_TIMEOUT_MS = 10_000;
const UNKNOWN: ShellViewer = { status: 'unknown' };

/**
 * The T5 demo inside the real (site) shell — the same tree as app/(site)/layout.tsx: the «Sari la
 * conținut» skip link, the top bar, the breadcrumb band from 768 (DashboardHeader drops its back
 * button there) and the bounded session read — so every state is measured and screenshotted on the
 * page it will live on.
 *
 * TODO(shell): export one SiteShell from app/(site)/layout.tsx and render it here instead of this
 * copy (this task may only touch T5).
 */
export default function T5DemoLayout({ children }: { children: ReactNode }) {
  const viewer = getViewer(); // not awaited, as in (site)
  const late = bounded(settled(viewer), LATE_SESSION_TIMEOUT_MS);
  const shell = bounded(late, SHELL_SESSION_TIMEOUT_MS);
  return (
    <ViewerProvider viewer={viewer} shell={shell} late={late}>
      <a
        href="#continut"
        className="t-body-strong sr-only z-skip rounded-control bg-surface text-accent-ink shadow-e2 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
      >
        Sari la conținut
      </a>
      <ToastProvider>
        <BreadcrumbProvider>
          <div className="relative min-h-dvh overflow-x-clip">
            <div id="shell-scroll-sentinel" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
            <SiteTopBar />
            <PageBreadcrumbs />
            <main id="continut" tabIndex={-1} className={cn('mx-auto scroll-mt-14 outline-none md:scroll-mt-16', SHELL_MAX)}>
              {children}
            </main>
          </div>
        </BreadcrumbProvider>
      </ToastProvider>
    </ViewerProvider>
  );
}

/** The session read for the bar: never rejects; a failure is «unknown», never «signed out». */
function settled(viewer: Promise<Viewer | null>): Promise<ShellViewer> {
  return viewer.then(
    (v) => v,
    () => UNKNOWN,
  );
}

/** The session read, or «unknown» after `ms` (the timer only runs for a real request). */
async function bounded(viewer: Promise<ShellViewer>, ms: number): Promise<ShellViewer> {
  await connection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ShellViewer>((resolve) => {
    timer = setTimeout(() => resolve(UNKNOWN), ms);
  });
  try {
    return await Promise.race([viewer, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
