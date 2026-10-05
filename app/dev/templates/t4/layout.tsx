import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getViewer, type Viewer } from '@/lib/server/viewer';
import { BreadcrumbProvider } from '../../../(site)/_shell/SiteHeader';
import { ToastProvider } from '../../../(site)/_shell/Toast';
import { ViewerProvider, type ShellViewer } from '../../../(site)/_shell/viewer-context';
import { DemoTopBar } from './DemoTopBar';
import { recheckSession } from './session';

/** app/(site)/layout.tsx: how long the top bar waits for the session, and the outer bound. */
const SHELL_SESSION_TIMEOUT_MS = 4000;
const LATE_SESSION_TIMEOUT_MS = 10_000;
const UNKNOWN: ShellViewer = { status: 'unknown' };

/**
 * The T4 demo inside the real (site) shell, as T5's: the skip link, the product's top bar
 * (SiteTopBar — Administrare for organisers and operators, ⌘K search, ☰ menu, the unread dot and
 * the phone hide-on-scroll that T4Header follows) and the bounded session read. Here, not in the
 * page, so the route's error boundary (error.tsx) renders inside the same chrome. <main> carries
 * no column cap: T4Frame's header band is full bleed and caps its own rows (SHELL_MAX).
 *
 * TODO(shell): export one SiteShell from app/(site)/layout.tsx and render it here instead of this
 * copy (this task may only touch T4).
 */
export default function T4DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
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
          <div className="relative min-h-dvh overflow-x-clip bg-page">
            <div id="shell-scroll-sentinel" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
            <DemoTopBar />
            {children}
          </div>
        </BreadcrumbProvider>
      </ToastProvider>
    </ViewerProvider>
  );
}

/**
 * The session read for the bar: never rejects; a failure is «unknown», never «signed out».
 * getViewer() resolves null for ANY non-401 failure too, so a null with a session cookie is asked
 * again (the page's own check, ./session): only no cookie or a dead session (401) is signed out —
 * so the bar never says «Intră» while the page shows a signed-in user's load error.
 */
function settled(viewer: Promise<Viewer | null>): Promise<ShellViewer> {
  return viewer.then(
    async (v) => {
      if (v) return v;
      const session = await recheckSession(LATE_SESSION_TIMEOUT_MS);
      return session === 'none' || session === 'dead' ? null : UNKNOWN;
    },
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
