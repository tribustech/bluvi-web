import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { SiteShell } from '../../../(site)/_shell/SiteShell';
import { StateSwitcher } from './StateSwitcher';
import { StateSwitcherFromUrl } from './StateSwitcherFromUrl';

/**
 * /dev/templates/t1's frame: THE app shell (app/(site)/_shell/SiteShell.tsx — skip link, top bar
 * with its ☰ menu and ⌘K palette, the scroll sentinel, <main>) and the state band at the top of
 * <main>. Here, not in the page, so the route's error boundary (error.tsx) renders INSIDE it — a
 * crash keeps the viewer's shell. `?state=signed-out` / `gate` force the signed-out bar, as the
 * page forces the signed-out list; every other state shows the real session (an unknown one is the
 * bar's retry slot, never «Intră»). No layout breadcrumb band: a list is a section page
 * (SiteHeader ownsBreadcrumbBand).
 */
export default function T1DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <SiteShell forced={{ param: 'state', out: ['signed-out', 'gate'] }}>
      <Suspense fallback={<StateSwitcher />}>
        <StateSwitcherFromUrl />
      </Suspense>
      {children}
    </SiteShell>
  );
}
