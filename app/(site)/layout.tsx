import type { ReactNode } from 'react';
import { NavigationShell } from '@/components/nav/NavigationShell';
import { getViewer } from '@/lib/server/viewer';
import { BreadcrumbProvider, SiteHeader } from './_shell/SiteHeader';
import { ViewerProvider } from './_shell/viewer-context';

/**
 * App shell for every product page (Fundații breakpoints):
 * - <768: content, tab bar fixed at the bottom (safe-area padded).
 * - 768–1279: rail 72px + content.
 * - ≥1280: side menu 248px + desktop header (breadcrumb, ⌘K, notifications, avatar) + content.
 * - ≥1440: content max 1120px, centred.
 *
 * The session is read without awaiting it: the chrome renders signed out in the static shell and
 * the signed-in parts (Profil tab, avatar) stream in behind their own Suspense boundaries, so
 * public pages stay prerenderable. Pages own their padding (mobile heroes are full-bleed).
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const viewer = getViewer(); // not awaited — see above
  return (
    <ViewerProvider viewer={viewer}>
      <a
        href="#continut"
        className="t-body-strong sr-only z-50 rounded-control bg-surface px-4 py-3 text-accent-ink shadow-e2 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3"
      >
        Sari la conținut
      </a>
      <BreadcrumbProvider>
        <NavigationShell signedIn={viewer.then((v) => v !== null)}>
          <SiteHeader className="sticky top-0 z-20 hidden xl:flex" />
          <main id="continut" tabIndex={-1} className="outline-none 2xl:mx-auto 2xl:max-w-[1120px]">
            {children}
          </main>
        </NavigationShell>
      </BreadcrumbProvider>
    </ViewerProvider>
  );
}
