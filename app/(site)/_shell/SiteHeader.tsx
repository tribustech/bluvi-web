'use client';

import { createContext, Suspense, use, useEffect, useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { usePathname } from 'next/navigation';
import { BreadcrumbBand, type Crumb } from '@/components/nav/Breadcrumbs';
import { routes } from '@/lib/routes';

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
  // Public waters live in the Bălți section (ape-publice/_components/trail.ts): the same parents
  // while a water page is still loading, so the band does not change words when it names itself.
  if (first === 'ape-publice') {
    return [{ label: 'Bălți', href: routes.lakes() }, rest.length > 0 ? { label: 'Ape publice', href: routes.publicWaters() } : { label: 'Ape publice' }];
  }
  const label = SECTION[first];
  if (!label) return [{ label: 'Acasă', href: '/' }];
  return rest.length > 0 ? [{ label, href: `/${first}` }] : [{ label }];
}

/**
 * Routes that render their own breadcrumb band on the server (real titles in the HTML, the
 * BreadcrumbList JSON-LD, nothing swapped on hydration) — or, for a section-level list or a flow
 * whose header owns the way back, none at all. The layout's band (PageBreadcrumbs) skips them.
 * A route flag, not a client mark: the decision is the same in the server HTML and after hydration.
 *  - /concursuri/<id> and its view segments (CompetitionRoute, loading.tsx, error.tsx);
 *  - the T6 scale flow (/concursuri/<id>/cantar…): its header owns the way back, as T4's;
 *  - the T1 / T3 / T4 / T6 template demos (/dev/templates): T3 as /concursuri/<id>, T1 a section
 *    list, T4 and T6 flows (their headers' back control — never a second way back above it).
 */
const OWN_BAND_ROUTES: readonly RegExp[] = [
  /^\/concursuri\/[^/]+(?:\/(?:clasament|cantare|statistici|capturi|informatii|participanti|extra-cantare|regulament))?\/?$/,
  /^\/concursuri\/[^/]+\/cantar(?:\/.*)?$/,
  // The competition chat (participant.chat): a viewport-tall surface whose header owns the way back.
  /^\/concursuri\/[^/]+\/chat\/?$/,
  // Știre and Sponsor (page, loading.tsx and error.tsx render the band; Noutăți / Acasă first).
  /^\/stiri\/[^/]+\/?$/,
  /^\/sponsori\/[^/]+\/?$/,
  /^\/dev\/templates\/t[1346]\/?$/,
  // Hartă bălți (and its T2 demo): the search header owns the way back («Arată lista», the Bălți
  // switch) and sits at the same y as /balti's — no crumb strip that moves it on list ↔ map. The
  // BreadcrumbList stays in the page's JSON-LD.
  /^\/balti\/harta\/?$/,
  /^\/dev\/templates\/t2\/?$/,
  // «Setări» (account.settings.c2): its header's back control owns the way back.
  /^\/setari\/?$/,
  // «Editează profilul» (T6, account.edit-profile): its header's back control owns the way back.
  /^\/setari\/profil\/?$/,
  // «Notificări» settings (account.notification-settings.c1): its header's back control owns the way
  // back (fish's header: back + title, no crumb).
  /^\/setari\/notificari\/?$/,
  // «Concursuri urmărite» (T1, account.notification-preferences.c1): the same — its back control.
  /^\/setari\/notificari\/concursuri\/?$/,
  // «Completează profilul» (T6, account.complete-profile.c1): no way back at all (fish goBack={false}).
  /^\/profil\/completeaza\/?$/,
  // The booking flow (T4, booking.rezerva-*): its header's back control owns the way back, and the
  // grid step is a viewport-tall frame with no room for a band above it.
  /^\/balti\/[^/]+\/rezerva(\/(extra|confirmare))?\/?$/,
  // Partide · Explorează (partide.exploreaza): a tab of the Partide hub, a section page like
  // /partide — no band, so switching tabs never moves the header.
  /^\/partide\/exploreaza\/?$/,
  // «Alătură-te unei partide» (T6, partide.intra): its header's back control owns the way back.
  /^\/partide\/intra\/?$/,
  // The same page with an invite's code (T6, partide.intra-cod): one way back, the header's chip.
  /^\/partide\/intra\/[^/]+\/?$/,
  // «Sondaj» (T6, participant.poll-current.c1): its header's back control owns the way back.
  /^\/sondaje\/?$/,
  // «Sondaje anterioare» (T1, participant.polls-past.c1): the same — its header's back control.
  /^\/sondaje\/anterioare\/?$/,
  // «Câștigători» (T6, participant.raffle-winners): its header's back control owns the way back.
  /^\/tombola\/castigatori\/?$/,
  // «Șansele mele» (T6, participant.raffle-status): the same — its header's back control.
  /^\/tombola\/sansele-mele\/?$/,
  // «Încarcă bonul fiscal» (T6, participant.raffle-upload-receipt): the same — its header's back control.
  /^\/tombola\/bon\/?$/,
  // «Bon încărcat» (T6, participant.raffle-receipt-submitted): the same — its header's back control.
  /^\/tombola\/bon-trimis\/?$/,
];

export function ownsBreadcrumbBand(pathname: string): boolean {
  return OWN_BAND_ROUTES.some((r) => r.test(pathname));
}

/** `owner`: the <SetBreadcrumb> instance that set it (useId), so only that one can clear it. */
type Override = { path: string; trail: Crumb[]; owner: string } | null;
const BreadcrumbContext = createContext<Dispatch<SetStateAction<Override>> | null>(null);
const OverrideContext = createContext<Override>(null);
const NotFoundSetContext = createContext<((path: string | null) => void) | null>(null);
const NotFoundContext = createContext<string | null>(null);

/**
 * Lets a page replace the URL-derived breadcrumb with real titles, e.g.
 * `<SetBreadcrumb trail={[{ label: 'Bălți', href: '/balti' }, { label: lake.name }]} />`.
 * The override is bound to the pathname it was set on, so it never leaks into the next page.
 * Client-side (an effect): the server HTML has the placeholder. A T3 page should rather render
 * <BreadcrumbBand jsonLd> itself on the server and be listed in OWN_BAND_ROUTES.
 */
export function SetBreadcrumb({ trail }: { trail: Crumb[] }) {
  // usePathname is request data on a dynamic route: under cacheComponents a prerender must not
  // block on it. The component renders nothing, so an empty fallback is exact.
  return (
    <Suspense fallback={null}>
      <SetBreadcrumbEffect trail={trail} />
    </Suspense>
  );
}

function SetBreadcrumbEffect({ trail }: { trail: Crumb[] }) {
  const set = use(BreadcrumbContext);
  const pathname = usePathname() ?? '/';
  const owner = useId();
  const key = JSON.stringify(trail);
  useEffect(() => {
    set?.({ path: pathname, trail: JSON.parse(key) as Crumb[], owner });
    // Clears only its own override: while a page streams, two instances swap (a Suspense fallback's,
    // then the content's), and the outgoing one's cleanup may run AFTER the incoming one set its
    // trail — an unconditional clear left the band on its placeholder for good.
    return () => set?.((o) => (o?.owner === owner ? null : o));
  }, [set, pathname, key, owner]);
  return null;
}

/**
 * Rendered by a 404 (not-found.tsx, the [...rest] catch-all): this URL is no page, so the top bar
 * highlights no section and no breadcrumb band is shown. Bound to the pathname like SetBreadcrumb.
 */
export function MarkNotFound() {
  return (
    <Suspense fallback={null}>
      <MarkNotFoundEffect />
    </Suspense>
  );
}

function MarkNotFoundEffect() {
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
  if (pathname === routes.signIn()) return routes.signIn();
  const query = search.startsWith('?') ? search.slice(1) : search;
  return routes.signIn(query ? `${pathname}?${query}` : pathname);
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
 * row): the page below it never moves when the real trail lands. Pages that render their own band
 * on the server (OWN_BAND_ROUTES — the robust form: real titles and JSON-LD in the HTML) are
 * skipped. Until a page names itself, a deep URL shows its section as a linked parent and a neutral
 * placeholder for the current crumb: the section is never announced as the current page.
 */
export function PageBreadcrumbs() {
  return (
    <Suspense fallback={<BreadcrumbBand trail={[]} pendingCurrent />}>
      <LiveBreadcrumbs />
    </Suspense>
  );
}

/**
 * How long a deep page may take to name itself (<SetBreadcrumb>) after the band has mounted before
 * the placeholder crumb gives up: past it the band shows the URL-derived trail, never a grey bone
 * that stays (a page that never names itself, or a name that got lost).
 */
const NAME_DEADLINE_MS = 3000;

function LiveBreadcrumbs() {
  const pathname = usePathname() ?? '/';
  const override = use(OverrideContext);
  const notFound = useIsNotFound(pathname);
  const deep = pathname.split('/').filter(Boolean).length > 1;
  const named = override?.path === pathname;
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (named || !deep) return;
    const timer = setTimeout(() => setExpired(pathname), NAME_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [named, deep, pathname]);
  if (notFound || ownsBreadcrumbBand(pathname)) return null;
  const trail = named ? withParentLinks(override.trail, pathname) : crumbsForPath(pathname);
  if (!deep && trail.length < 2) return null;
  return <BreadcrumbBand trail={trail} pendingCurrent={deep && !named && expired !== pathname} />;
}
