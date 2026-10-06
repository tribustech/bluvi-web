import type { ReactNode } from 'react';
import { SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { ForcedSession, type ForcedSessionRule } from './ForcedSession';
import { getShellSession, getViewerState } from './session';
import { NavigationGuard } from './NavigationGuard';
import { NetworkBanner } from './NetworkBanner';
import { BreadcrumbProvider, PageBreadcrumbs } from './SiteHeader';
import { SiteTopBar } from './SiteTopBar';
import { ToastProvider } from './Toast';
import { ViewerProvider } from './viewer-context';

/**
 * THE app shell — app/(site)/layout.tsx renders it, and so does every template demo under
 * /dev/templates, so what the owner approves is what the product ships (ROADMAP §4, 2026-10-04):
 * - a top bar at every width: <768 logo, search, notifications, avatar or «Intră», ☰ → menu panel;
 *   ≥768 logo, Acasă · Bălți · Competiții · Partide, Administrare (organiser / operator), search
 *   (⌘K field from 1280), notifications, avatar menu. Sticky, hairline bottom border, 56 / 64px;
 * - the «Sari la conținut» skip link, the #shell-scroll-sentinel (the bar lifts once the page
 *   scrolls under it), the offline banner under the bar (NetworkBanner), the navigation
 *   double-activation guard (NavigationGuard), and from 768 the breadcrumb band of pages deeper than a section — unless
 *   the route renders its own band on the server (SiteHeader ownsBreadcrumbBand);
 * - width (owner decision 2026-10-04): the bar's surface is full width; its row, the breadcrumb
 *   band and <main> share one column, full width up to 1680 of content (SHELL_MAX = 1680 + 2×32
 *   gutters) and centred beyond it. Pages own their gutters (mobile heroes are full-bleed).
 *   overflow-x-clip: a full-bleed band (T3 HeaderBand, FULL_BLEED_BG) can never add a horizontal
 *   scroll; `clip` (unlike `hidden`) creates no scroll container, so the sticky bar keeps working.
 *
 * The session (./session.ts — the user, signed out, or unknown) is read without awaiting it: the
 * chrome renders with a neutral avatar placeholder in the static shell and the signed-in parts
 * stream in behind their own Suspense boundaries, so public pages stay prerenderable. The read is
 * bounded by its own deadline, so the stream always closes; the bar's first copy is bounded tighter
 * (session.ts getShellSession — the same bound Acasă reveals on, so bar and body flip to «unknown»
 * together) and upgrades itself from the full read.
 *
 * `forced` (demos only): query-string values that force the chrome's session (signed out /
 * unknown), the way a demo forces its page's state.
 */
export function SiteShell({ children, forced }: { children: ReactNode; forced?: ForcedSessionRule }) {
  const viewer = getViewerState(); // not awaited — see above
  const shell = getShellSession(); // not awaited either
  const bar = <SiteTopBar />;
  return (
    <ViewerProvider viewer={viewer} shell={shell}>
      {/* `not-sr-only` resets padding to 0, so the box is re-applied inside the focus variant. */}
      <a
        href="#continut"
        className="t-body-strong sr-only z-skip rounded-control bg-surface text-accent-ink shadow-e2 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
      >
        Sari la conținut
      </a>
      {/* One listener: a second activation of the same link while it is loading is dropped. */}
      <NavigationGuard />
      <ToastProvider>
        <BreadcrumbProvider>
          <div className="relative min-h-dvh overflow-x-clip">
            {/* Top-of-page sentinel: once it scrolls out, the bar lifts (SiteTopBar useScrolled). */}
            <div id="shell-scroll-sentinel" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
            {forced ? <ForcedSession rule={forced}>{bar}</ForcedSession> : bar}
            {/* Offline: a strip sticky right under the bar (nothing while online). */}
            <NetworkBanner />
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
