'use client';

import { createContext, Suspense, use, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DesktopHeader, type Crumb } from '@/components/nav/DesktopHeader';
import { useViewer } from './viewer-context';

/** First path segment → label. Sections that are not pages yet still get a readable crumb. */
const SECTION: Record<string, string> = {
  balti: 'Bălți',
  concursuri: 'Competiții',
  partide: 'Partide',
  profil: 'Profil',
  intra: 'Intră',
  notificari: 'Notificări',
  cauta: 'Căutare',
  stiri: 'Știri',
  pescari: 'Pescari',
};

/**
 * Breadcrumb from the URL: «Acasă» on /, else the section, linked when the page is deeper.
 * Entity titles are not in the URL (documentIds); a page sets them with <SetBreadcrumb>.
 */
export function crumbsForPath(pathname: string): Crumb[] {
  const [first, ...rest] = pathname.split('/').filter(Boolean);
  if (!first) return [{ label: 'Acasă' }];
  const label = SECTION[first];
  if (!label) return [{ label: 'Acasă', href: '/' }];
  return rest.length > 0 ? [{ label, href: `/${first}` }] : [{ label }];
}

type Override = { path: string; trail: Crumb[] } | null;
const BreadcrumbContext = createContext<((o: Override) => void) | null>(null);
const OverrideContext = createContext<Override>(null);

/**
 * Lets a page replace the URL-derived breadcrumb with real titles, e.g.
 * `<SetBreadcrumb trail={[{ label: 'Competiții', href: '/concursuri' }, { label: competition.name }]} />`.
 * The override is bound to the pathname it was set on, so it never leaks into the next page.
 */
export function SetBreadcrumb({ trail }: { trail: Crumb[] }) {
  const set = use(BreadcrumbContext);
  const pathname = usePathname() ?? '/';
  const key = JSON.stringify(trail);
  useEffect(() => {
    set?.({ path: pathname, trail: JSON.parse(key) as Crumb[] });
    return () => set?.(null);
  }, [set, pathname, key]);
  return null;
}

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Override>(null);
  return (
    <BreadcrumbContext value={setOverride}>
      <OverrideContext value={override}>{children}</OverrideContext>
    </BreadcrumbContext>
  );
}
/** «Intră» returns to the page it was pressed on (not to /intra itself). */
export function signInHref(pathname: string): string {
  if (pathname === '/intra' || pathname === '/') return '/intra';
  return `/intra?next=${encodeURIComponent(pathname)}`;
}

function HeaderWithViewer({ breadcrumb, pathname, className }: { breadcrumb: Crumb[]; pathname: string; className: string }) {
  const viewer = useViewer();
  return (
    <DesktopHeader
      breadcrumb={breadcrumb}
      user={viewer ? { name: viewer.username, avatarUrl: viewer.avatarUrl } : undefined}
      signInHref={viewer || pathname === '/intra' ? undefined : signInHref(pathname)}
      className={className}
    />
  );
}

/**
 * Desktop header of the shell (≥1280): breadcrumb, ⌘K search, notifications, avatar.
 * Two boundaries: the pathname (request data on dynamic routes) and then the session. The static
 * shell carries the search field; crumbs and avatar/«Intră» stream in.
 */
export function SiteHeader({ className = '' }: { className?: string }) {
  return (
    <Suspense fallback={<DesktopHeader breadcrumb={[]} className={className} />}>
      <HeaderWithPath className={className} />
    </Suspense>
  );
}

function HeaderWithPath({ className }: { className: string }) {
  const pathname = usePathname() ?? '/';
  const override = use(OverrideContext);
  const breadcrumb = override?.path === pathname ? override.trail : crumbsForPath(pathname);
  return (
    <Suspense fallback={<DesktopHeader breadcrumb={breadcrumb} className={className} />}>
      <HeaderWithViewer breadcrumb={breadcrumb} pathname={pathname} className={className} />
    </Suspense>
  );
}
