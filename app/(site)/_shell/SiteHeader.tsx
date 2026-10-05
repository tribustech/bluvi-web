'use client';

import { createContext, Suspense, use, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BreadcrumbBand, type Crumb } from '@/components/nav/Breadcrumbs';

export type { Crumb };

/** First path segment → label. Sections that are not pages yet still get a readable crumb. */
const SECTION: Record<string, string> = {
  balti: 'Bălți',
  concursuri: 'Competiții',
  partide: 'Partide',
  profil: 'Profil',
  setari: 'Setări',
  intra: 'Intră',
  notificari: 'Notificări',
  cauta: 'Căutare',
  stiri: 'Știri',
  pescari: 'Pescari',
  organizator: 'Concursurile mele',
  operator: 'Panou baltă',
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
const NotFoundSetContext = createContext<((path: string | null) => void) | null>(null);
const NotFoundContext = createContext<string | null>(null);

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

/**
 * Rendered by a 404 (not-found.tsx, the [...rest] catch-all): this URL is no page, so the top bar
 * highlights no section and no breadcrumb band is shown. Bound to the pathname like SetBreadcrumb.
 */
export function MarkNotFound() {
  const set = use(NotFoundSetContext);
  const pathname = usePathname() ?? '/';
  useEffect(() => {
    set?.(pathname);
    return () => set?.(null);
  }, [set, pathname]);
  return null;
}

/** Whether the current pathname was marked as a 404 by <MarkNotFound>. */
export function useIsNotFound(pathname: string | undefined): boolean {
  const path = use(NotFoundContext);
  return pathname !== undefined && path === pathname;
}

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Override>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  return (
    <BreadcrumbContext value={setOverride}>
      <NotFoundSetContext value={setNotFound}>
        <OverrideContext value={override}>
          <NotFoundContext value={notFound}>{children}</NotFoundContext>
        </OverrideContext>
      </NotFoundSetContext>
    </BreadcrumbContext>
  );
}

/**
 * «Intră» returns to the page it was pressed on, filters included (`search`: the query string,
 * with or without its «?»), never to /intra itself. /intra validates `next` as a safe path.
 */
export function signInHref(pathname: string, search = ''): string {
  if (pathname === '/intra') return '/intra';
  const query = search.startsWith('?') ? search.slice(1) : search;
  const back = query ? `${pathname}?${query}` : pathname;
  if (back === '/') return '/intra';
  return `/intra?next=${encodeURIComponent(back)}`;
}

/**
 * A page's trail with every parent linked: a crumb a page set without `href` («Competiții») takes
 * the URL-derived section link when its label matches, so the parent stays a link.
 */
function withParentLinks(trail: Crumb[], pathname: string): Crumb[] {
  const derived = crumbsForPath(pathname);
  return trail.map((c, i) => {
    if (c.href || i === trail.length - 1) return c;
    const match = derived.find((d) => d.label === c.label && d.href);
    return match ? { ...c, href: match.href } : c;
  });
}

/**
 * The breadcrumb band between the bar and <main> (≥768; phones navigate with the screen's own back
 * button). Shown on pages below a section (/concursuri/<id>, …): a section page already names
 * itself in its title. Full-bleed bg-surface (BreadcrumbBand), the start of the page header
 * surface, so bar → crumbs → T3 hero read as one white header at every width.
 *
 * The row needs the pathname, which on a dynamic route is request data, so on those routes it
 * streams in behind this boundary. Only dynamic routes suspend here and nearly all of them are deep
 * (/concursuri/<id>), so the fallback is a band of the same shape (a placeholder crumb, same 24px
 * row): the page below it never moves when the real trail lands. The robust fix is still for T3
 * pages to render <BreadcrumbBand> themselves on the server (real titles, JSON-LD) and for this
 * layout row to go away. Until the page names itself, a deep URL shows its section as a linked
 * parent and a neutral placeholder for the current crumb: the section is never announced as the
 * current page.
 */
export function PageBreadcrumbs() {
  return (
    <Suspense fallback={<BreadcrumbBand trail={[]} pendingCurrent />}>
      <LiveBreadcrumbs />
    </Suspense>
  );
}

function LiveBreadcrumbs() {
  const pathname = usePathname() ?? '/';
  const override = use(OverrideContext);
  const notFound = useIsNotFound(pathname);
  const deep = pathname.split('/').filter(Boolean).length > 1;
  if (notFound) return null;
  const named = override?.path === pathname;
  const trail = named ? withParentLinks(override.trail, pathname) : crumbsForPath(pathname);
  if (!deep && trail.length < 2) return null;
  return <BreadcrumbBand trail={trail} pendingCurrent={deep && !named} />;
}
