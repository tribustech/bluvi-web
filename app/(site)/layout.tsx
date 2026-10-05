import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { getViewer, type Viewer } from '@/lib/server/viewer';
import { BreadcrumbProvider, PageBreadcrumbs } from './_shell/SiteHeader';
import { SiteTopBar } from './_shell/SiteTopBar';
import { ToastProvider } from './_shell/Toast';
import { ViewerProvider, type ShellViewer } from './_shell/viewer-context';

/** How long the top bar waits for the session before it shows the «unknown» account slot. */
const SHELL_SESSION_TIMEOUT_MS = 4000;

/**
 * The outer bound on the session read: a hung CMS (the server fetches have no timeout of their own)
 * resolves the late copy to «unknown» here, so the RSC stream always closes and «Reîncearcă» stays
 * meaningful. TODO(lib/server): also abort the /users/me and /feed/owned-lakes fetches
 * (`signal: AbortSignal.timeout(...)`), so the request itself stops.
 */
const LATE_SESSION_TIMEOUT_MS = 10_000;

const UNKNOWN: ShellViewer = { status: 'unknown' };

/**
 * App shell for every product page — a top bar at every width (ROADMAP §4, 2026-10-04):
 * - <768: logo, search, notifications, avatar or «Intră», ☰ → menu panel.
 * - ≥768: logo, Acasă · Bălți · Competiții · Partide, Administrare (organiser/operator), search
 *   (⌘K field from 1280), notifications, avatar menu. Sticky, hairline bottom border, 56 / 64px.
 * - Width (owner decision 2026-10-04): the bar's surface is full width; its row, the breadcrumb
 *   band and <main> share one column, full width up to 1680 of content (SHELL_MAX = 1680 + 2×32
 *   gutters) and centred beyond it. Pages own their gutters (mobile heroes are full-bleed).
 * Below the bar, from 768, the breadcrumb band of pages deeper than a section.
 *
 * The session is read without awaiting it: the chrome renders with a neutral avatar placeholder in
 * the static shell and the signed-in parts stream in behind their own Suspense boundaries, so
 * public pages stay prerenderable. The bar's copy of the read is bounded (SHELL_SESSION_TIMEOUT_MS)
 * so a hung CMS never leaves it loading; a late answer still upgrades the bar (`late`, itself
 * bounded by LATE_SESSION_TIMEOUT_MS so the stream always ends).
 *
 * overflow-x-clip: a full-bleed band (T3 HeaderBand) can never add a horizontal scroll; `clip`
 * (unlike `hidden`) creates no scroll container, so the sticky bar keeps working.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const viewer = getViewer(); // not awaited — see above
  const late = bounded(settled(viewer), LATE_SESSION_TIMEOUT_MS);
  const shell = bounded(late, SHELL_SESSION_TIMEOUT_MS);
  return (
    <ViewerProvider viewer={viewer} shell={shell} late={late}>
      {/* `not-sr-only` resets padding to 0, so the box is re-applied inside the focus variant. */}
      <a
        href="#continut"
        className="t-body-strong sr-only z-skip rounded-control bg-surface text-accent-ink shadow-e2 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
      >
        Sari la conținut
      </a>
      <ToastProvider>
        <BreadcrumbProvider>
          <div className="relative min-h-dvh overflow-x-clip">
            {/* Top-of-page sentinel: once it scrolls out, the bar lifts (SiteTopBar useScrolled). */}
            <div id="shell-scroll-sentinel" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
            <SiteTopBar />
            <PageBreadcrumbs />
            {/* scroll-mt: the skip link lands below the sticky bar (56 / 64), not under it. */}
            <main id="continut" tabIndex={-1} className={cn('mx-auto scroll-mt-14 outline-none md:scroll-mt-16', SHELL_MAX)}>
              {children}
            </main>
          </div>
        </BreadcrumbProvider>
      </ToastProvider>
    </ViewerProvider>
  );
}

/**
 * The session read for the bar: never rejects. A failure (or a result lib/server/viewer.ts marks
 * as unknown) is «unknown», never «signed out».
 */
function settled(viewer: Promise<Viewer | null>): Promise<ShellViewer> {
  return viewer.then(
    (v) => v,
    () => UNKNOWN,
  );
}

/**
 * The session read, or «unknown» if it has not answered within `ms`. `connection()` first: the
 * timer must only run for a real request, never during prerendering (where the read never resolves).
 */
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
