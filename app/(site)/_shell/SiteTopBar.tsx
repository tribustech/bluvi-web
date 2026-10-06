'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition, type RefObject } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsKeys, unreadNotificationsCountQuery } from '@/core/social';
import { CommandPalette } from '@/components/nav/CommandPalette';
import { activeAdminKey, adminLinks, currentKind, navKeyForPath, PATHS, SECTIONS, type AdminLink } from '@/components/nav/items';
import { MobileMenu, type MenuSession } from '@/components/nav/MobileMenu';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';
import { TopBar, type TopBarViewer } from '@/components/nav/TopBar';
import { createBrowserTransport } from '@/lib/client/transport';
import { signInHref, useIsNotFound } from './SiteHeader';
import { useSiteToast } from './Toast';
import { isUnknownViewer, useShellViewer, useViewerState, type ShellViewer } from './viewer-context';

/** The unread dot: refreshed every 2 min, on focus, and whenever /notificari is opened. */
const UNREAD_STALE_MS = 60_000;
const UNREAD_POLL_MS = 120_000;

/** Phone hide-on-scroll: ignore jitter below this many px; always show within the bar's height. */
const CONCEAL_DELTA_PX = 4;
const CONCEAL_TOP_PX = 56;

/** What the bar has resolved so far; undefined = not known yet. */
type Known = { pathname?: string; viewer?: ShellViewer };

type Derived = {
  /** true / false once known; null while resolving or when the session could not be read. */
  signedIn: boolean | null;
  session: MenuSession;
  admin: AdminLink[];
  /** /feed/owned-lakes failed: Administrare stays, with a retry row (never silently dropped). */
  adminFailed: boolean;
  active?: string;
  /** 'page' on the active entry's own page, 'true' below it (a parent section). */
  activeCurrent: 'page' | 'true';
  signIn?: string;
};

/** Pages the bar or the menus link to outside the sections and Administrare. */
const ACCOUNT_HREF: Record<string, string> = {
  profil: PATHS.profile,
  setari: PATHS.settings,
  notificari: PATHS.notifications,
};

/**
 * `notFound`: the page is a 404 (<MarkNotFound>), so no section is highlighted. `search`: the
 * query string, so «Intră» returns to the filtered page.
 */
function derive({ pathname, viewer }: Known, notFound = false, search = ''): Derived {
  const resolved = viewer !== undefined && !isUnknownViewer(viewer);
  const user = viewer === undefined || viewer === null || isUnknownViewer(viewer) ? null : viewer;
  const admin = user ? adminLinks(user) : [];
  const adminFailed = !!user?.ownedLakesFailed;
  const active =
    pathname === undefined || notFound
      ? undefined
      : (activeAdminKey(admin, pathname) ?? navKeyForPath(pathname) ?? pathname.split('/')[1]);
  const activeHref =
    active === undefined
      ? undefined
      : (admin.find((a) => a.key === active)?.href ?? SECTIONS.find((i) => i.key === active)?.href ?? ACCOUNT_HREF[active]);
  return {
    signedIn: resolved ? user !== null : null,
    session: viewer === undefined ? 'pending' : isUnknownViewer(viewer) ? 'unknown' : user ? 'in' : 'out',
    admin,
    adminFailed,
    active,
    activeCurrent: activeHref === undefined ? 'true' : currentKind(activeHref, pathname),
    signIn: pathname === undefined || pathname === '/intra' ? undefined : signInHref(pathname, search),
  };
}

/**
 * The site's top bar with its phone menu panel and ⌘K palette. The bar sits behind two Suspense
 * boundaries — the pathname (request data on dynamic routes), then the session — and until the
 * session resolves the avatar slot holds a neutral placeholder, so a signed-in visitor never sees
 * «Intră» flash. The panel and the palette are rendered once, outside both boundaries: they keep
 * their state (typed query, focus) while the bar's fallbacks are swapped for the resolved bar,
 * which reports what it knows upwards.
 */
export function SiteTopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [known, setKnown] = useState<Known>({});
  const [search, setSearch] = useState('');
  const toast = useSiteToast();
  const router = useRouter();

  // Retry an unknown session: router.refresh() re-reads it on the server. In a transition, so the
  // bar keeps its slot (busy) instead of falling back, and isPending covers the whole re-read.
  const [retrying, startRetry] = useTransition();
  const retry = useCallback(() => startRetry(() => router.refresh()), [router]);
  const announce = useRetryAnnouncement(retrying, known.viewer);

  // After a confirmed sign-out, focus lands on «Intră» once the bar shows it (not on <body>).
  const focusSignInRef = useRef(false);

  // «Ieși din cont»: one run at a time, busy from the press until the signed-out bar commits (the
  // POST, then router.refresh() in the same transition). Only a confirmed sign-out clears the user's
  // data; a failed one leaves everything as it was. The unread query is off while it runs
  // (`signingOut`), so qc.clear() never rebuilds it without a cookie.
  const qc = useQueryClient();
  const [signingOut, startSignOut] = useTransition();
  const signOutBusy = useRef(false);
  useEffect(() => {
    if (!signingOut) signOutBusy.current = false;
  }, [signingOut]);
  const signOut = useCallback(() => {
    if (signOutBusy.current) return;
    signOutBusy.current = true;
    startSignOut(async () => {
      let ok = false;
      try {
        ok = (await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })).ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        toast('Nu am putut închide sesiunea. Încearcă din nou.', 'danger');
        return;
      }
      qc.clear();
      focusSignInRef.current = true;
      // After an await the update is no longer in the transition: wrap it again.
      startSignOut(() => router.refresh());
    });
  }, [qc, router, toast]);

  // ⌘K / Ctrl+K opens the palette from anywhere (toggles when it is already open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMenuOpen(false);
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scrolled = useScrolled();
  const concealed = useConcealOnScroll(menuOpen || searchOpen);

  const bar: BarProps = {
    menuOpen,
    scrolled,
    concealed,
    search,
    onMenu: useCallback(() => setMenuOpen(true), []),
    onSearch: useCallback(() => setSearchOpen(true), []),
    report: setKnown,
    onSignOut: signOut,
    signingOut,
    onRetry: retry,
    retrying,
    focusSignInRef,
  };
  const notFound = useIsNotFound(known.pathname);
  const { signedIn, session, admin, adminFailed, active, activeCurrent, signIn } = useMemo(
    () => derive(known, notFound, search),
    [known, notFound, search],
  );
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <>
      <Suspense fallback={<Bar {...bar} />}>
        <WithPath {...bar} />
      </Suspense>
      {/* The query string is read apart from the bar (its own boundary, renders nothing), so the
          bar's server render never waits on search params. */}
      <Suspense fallback={null}>
        <SearchReporter report={setSearch} />
      </Suspense>
      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        session={session}
        onSignOut={signOut}
        signingOut={signingOut}
        onRetry={retry}
        retrying={retrying}
        signInHref={signIn}
        active={active}
        activeCurrent={activeCurrent}
        admin={admin}
        onAdminRetry={adminFailed ? retry : undefined}
        resetKey={known.pathname}
      />
      <CommandPalette
        open={searchOpen}
        onClose={closeSearch}
        signedIn={signedIn}
        sessionUnknown={session === 'unknown'}
        signInHref={signIn}
        admin={admin}
      />
      <p role="status" className="sr-only">
        {signingOut ? 'Se închide sesiunea…' : announce}
      </p>
    </>
  );
}

type BarProps = {
  menuOpen: boolean;
  scrolled: boolean;
  concealed: boolean;
  search: string;
  onMenu: () => void;
  onSearch: () => void;
  report: (k: Known) => void;
  onSignOut: () => void;
  signingOut: boolean;
  onRetry: () => void;
  retrying: boolean;
  focusSignInRef: RefObject<boolean>;
};

function WithPath(props: BarProps) {
  const pathname = usePathname() ?? '/';
  return (
    <Suspense fallback={<Bar {...props} pathname={pathname} />}>
      <WithViewer {...props} pathname={pathname} />
    </Suspense>
  );
}

/**
 * When the bar's bounded read timed out («unknown») the real read may still answer a moment later:
 * the bar shows the unknown slot meanwhile and upgrades itself from the page's own read (the same
 * promise the body waits for, itself bounded in ./session.ts), so the bar and the body agree as
 * soon as either knows, and the retry button is only left for real failures.
 */
function WithViewer(props: BarProps & { pathname: string }) {
  const viewer = useShellViewer();
  if (!isUnknownViewer(viewer)) return <Bar {...props} viewer={viewer} />;
  return (
    <Suspense fallback={<Bar {...props} viewer={viewer} />}>
      <LateViewer {...props} />
    </Suspense>
  );
}

function LateViewer(props: BarProps & { pathname: string }) {
  const viewer = useViewerState();
  return <Bar {...props} viewer={viewer} />;
}

/** `viewer`: undefined = still resolving. `pathname` undefined = not known yet. */
function Bar({
  pathname,
  viewer,
  menuOpen,
  scrolled,
  concealed,
  search,
  onMenu,
  onSearch,
  report,
  onSignOut,
  signingOut,
  onRetry,
  retrying,
  focusSignInRef,
}: BarProps & Known) {
  const qc = useQueryClient();
  const t = useMemo(() => createBrowserTransport(), []);
  const notFound = useIsNotFound(pathname);
  const { signedIn, admin, adminFailed, active, activeCurrent, signIn } = useMemo(
    () => derive({ pathname, viewer }, notFound, search),
    [pathname, viewer, notFound, search],
  );

  useEffect(() => {
    report({ pathname, viewer });
  }, [report, pathname, viewer]);

  const unread = useQuery({
    ...unreadNotificationsCountQuery(t, { isAuthenticated: signedIn === true && !signingOut }),
    staleTime: UNREAD_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: UNREAD_POLL_MS,
  });

  // Opening the notifications page is when the count changes: re-read it there.
  useEffect(() => {
    if (signedIn === true && pathname === '/notificari') void qc.invalidateQueries({ queryKey: notificationsKeys.unread });
  }, [qc, signedIn, pathname]);

  const topBarViewer: TopBarViewer =
    viewer === undefined
      ? { status: 'pending' }
      : isUnknownViewer(viewer)
        ? { status: 'unknown' }
        : viewer === null
          ? { status: 'out', signInHref: signIn }
          : { status: 'in', name: viewer.username, avatarUrl: viewer.avatarUrl };

  useEffect(() => {
    if (!focusSignInRef.current || topBarViewer.status !== 'out') return;
    focusSignInRef.current = false;
    const target = document.querySelector<HTMLElement>('header [data-sign-in]') ?? document.getElementById('continut');
    target?.focus();
  }, [focusSignInRef, topBarViewer.status]);

  return (
    <TopBar
      viewer={topBarViewer}
      active={active}
      activeCurrent={activeCurrent}
      admin={admin}
      onAdminRetry={adminFailed ? onRetry : undefined}
      hasUnread={!signingOut && (unread.data ?? 0) > 0}
      onSearch={onSearch}
      onMenu={onMenu}
      onSignOut={onSignOut}
      onRetry={onRetry}
      retrying={retrying}
      signingOut={signingOut}
      menuOpen={menuOpen}
      resetKey={pathname}
      scrolled={scrolled}
      concealed={concealed}
      className="sticky top-0 z-sticky"
    />
  );
}

/** Reports the query string upwards (for «Intră»'s return path); renders nothing. */
function SearchReporter({ report }: { report: (search: string) => void }) {
  const params = useSearchParams();
  const search = params?.toString() ?? '';
  useEffect(() => {
    report(search);
  }, [report, search]);
  return null;
}

/**
 * Whether the page has scrolled under the bar: the layout's 1px sentinel at the top of the page
 * (#shell-scroll-sentinel) has left the viewport. The bar then lifts (shadow-e1); at rest it keeps
 * only its hairline, so bar, breadcrumb and hero read as one header.
 */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('shell-scroll-sentinel');
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);
  return scrolled;
}

/**
 * Phone only (<768): the bar slides away while the visitor scrolls down and comes back on any
 * scroll up, near the top, while a panel is open (`hold`) or while focus is inside it, so the
 * page's own rows get the screen. Desktop never conceals.
 */
function useConcealOnScroll(hold: boolean): boolean {
  const [concealed, setConcealed] = useState(false);
  useEffect(() => {
    if (hold) return;
    const phone = window.matchMedia(`(max-width: ${BREAKPOINT_MD - 1}px)`);
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      const focusInBar = document.activeElement?.closest('header') != null;
      if (!phone.matches || y < CONCEAL_TOP_PX || focusInBar) setConcealed(false);
      else if (delta > CONCEAL_DELTA_PX) setConcealed(true);
      else if (delta < -CONCEAL_DELTA_PX) setConcealed(false);
      if (Math.abs(delta) > CONCEAL_DELTA_PX || y < CONCEAL_TOP_PX) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reveal = () => setConcealed(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    phone.addEventListener('change', reveal);
    document.addEventListener('focusin', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      phone.removeEventListener('change', reveal);
      document.removeEventListener('focusin', update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hold]);
  return concealed && !hold;
}

/**
 * What the polite status says about a retry: «Se verifică sesiunea…» while it runs, then the
 * outcome (signed in, signed out, or still unknown) — touch and keyboard users get the feedback the
 * tooltip alone never gave them.
 */
function useRetryAnnouncement(retrying: boolean, viewer: ShellViewer | undefined): string {
  const [retried, setRetried] = useState(false);
  if (retrying && !retried) setRetried(true);
  if (retrying) return 'Se verifică sesiunea…';
  if (!retried || viewer === undefined) return '';
  if (isUnknownViewer(viewer)) return 'Tot nu am putut verifica sesiunea. Încearcă din nou mai târziu.';
  return viewer ? 'Sesiunea a fost verificată. Ești conectat.' : 'Nu ești conectat.';
}
