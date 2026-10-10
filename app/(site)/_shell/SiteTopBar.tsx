'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition, type RefObject } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { notificationsKeys } from '@/core/social';
import { OPEN_PALETTE_EVENT } from '@/components/nav/openPalette';
import { activeAdminKey, adminLinks, currentKind, navKeyForPath, PATHS, SECTIONS, type AdminLink } from '@/components/nav/items';
import { TopBar, type TopBarViewer } from '@/components/nav/TopBar';
import { useSignOut } from '@/lib/client/sign-out';
import { createBrowserTransport } from '@/lib/client/transport';
import { signInHref, useIsNotFound } from './SiteHeader';
import { isUnknownViewer, useShellViewer, useViewerState, type ShellViewer } from './viewer-context';

/*
 * The ⌘K palette is a client-only chunk, fetched on the first opening (or once the page has loaded
 * and gone idle, so that opening is instant) — never in the first load: its search pulls core/lakes,
 * core/competitions, core/social and zod into the shell of every page (M8-B4,
 * global.b.performance-audit). The trigger button stays in the bar. (The phone ☰ panel is gone:
 * below 768 the shell is fish's bottom tab bar, ROADMAP §4b rule 25.)
 */
const loadPalette = () => import('@/components/nav/CommandPalette').then((m) => m.CommandPalette);
const CommandPalette = dynamic(loadPalette, { ssr: false });

/** true from the first time `open` is true: the panel then stays mounted (its state, its close). */
function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}

/** Fetches the palette's chunk once the page has loaded and gone idle (off the LCP path). */
function usePrefetchPanels() {
  useEffect(() => {
    let idle = 0;
    let timer = 0;
    const go = () => {
      loadPalette().catch(() => {});
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(go, { timeout: 5_000 });
      else timer = window.setTimeout(go, 2_000);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
}

/**
 * core/social's unreadNotificationsCountQuery, with the module (and zod) imported only when a
 * signed-in viewer's count is read. The key is core/social's `notificationsKeys.unread` (the type
 * checks it), so every invalidation of it elsewhere still reaches the dot.
 */
const UNREAD_KEY = ['notifications', 'unread'] as const satisfies typeof notificationsKeys.unread;
const readUnread = async (t: ReturnType<typeof createBrowserTransport>) =>
  (await import('@/core/social')).getUnreadNotificationsForLoggedInUser(t);

/** The unread dot: refreshed every 2 min, on focus, and whenever /notificari is opened. */
const UNREAD_STALE_MS = 60_000;
const UNREAD_POLL_MS = 120_000;

/** What the bar has resolved so far; undefined = not known yet. */
type Known = { pathname?: string; viewer?: ShellViewer };

type Derived = {
  /** true / false once known; null while resolving or when the session could not be read. */
  signedIn: boolean | null;
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
    admin,
    adminFailed,
    active,
    activeCurrent: activeHref === undefined ? 'true' : currentKind(activeHref, pathname),
    signIn: pathname === undefined || pathname === '/intra' ? undefined : signInHref(pathname, search),
  };
}

/**
 * The site's top bar (from 768; below it the shell is fish's: each screen's own header and the
 * bottom tab bar, ROADMAP §4b rule 25) and the ⌘K palette (also opened by a page's own search
 * button on the phone). The bar sits behind two Suspense
 * boundaries — the pathname (request data on dynamic routes), then the session — and until the
 * session resolves the avatar slot holds a neutral placeholder, so a signed-in visitor never sees
 * «Intră» flash. The palette is rendered once, outside both boundaries: it keeps
 * their state (typed query, focus) while the bar's fallbacks are swapped for the resolved bar,
 * which reports what it knows upwards.
 */
export function SiteTopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [known, setKnown] = useState<Known>({});
  const [search, setSearch] = useState('');
  const router = useRouter();

  // Administrare's «Reîncearcă» (the viewer's lakes could not be read): router.refresh() re-reads
  // them on the server, in a transition, so the row stays busy for the whole re-read.
  const [, startRetry] = useTransition();
  const retry = useCallback(() => startRetry(() => router.refresh()), [router]);

  // After a confirmed sign-out, focus lands on «Intră» once the bar shows it (not on <body>).
  const focusSignInRef = useRef(false);

  // «Ieși din cont»: the site's one sign-out (lib/client/sign-out, account.b.sign-out — also Setări's
  // «Deconectare»), busy from the press until the signed-out bar commits. The unread query is off
  // while ANY sign-out runs (`signingOut` is page-wide), so qc.clear() never rebuilds it without a
  // cookie.
  const armSignInFocus = useCallback(() => {
    focusSignInRef.current = true;
  }, []);
  const { signOut, signingOut } = useSignOut({ onDone: armSignInFocus });

  // ⌘K / Ctrl+K opens the palette from anywhere (toggles when it is already open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    // A page's own search button (openPalette, e.g. «Caută pescari») opens it too.
    const onOpen = () => {
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  const scrolled = useScrolled();

  const bar: BarProps = {
    scrolled,
    search,
    onSearch: useCallback(() => setSearchOpen(true), []),
    report: setKnown,
    onSignOut: signOut,
    signingOut,
    onAdminRetry: retry,
    focusSignInRef,
  };
  const notFound = useIsNotFound(known.pathname);
  const { signedIn, admin, signIn } = useMemo(() => derive(known, notFound, search), [known, notFound, search]);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchMounted = useOpenedOnce(searchOpen);
  usePrefetchPanels();

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
      {/* An unknown session is never shown (owner rule 4): it is re-read quietly in the background. */}
      <Suspense fallback={null}>
        <QuietSessionRetry />
      </Suspense>
      {searchMounted ? (
        <CommandPalette open={searchOpen} onClose={closeSearch} signedIn={signedIn} signInHref={signIn} admin={admin} />
      ) : null}
      <p role="status" className="sr-only">
        {signingOut ? 'Se închide sesiunea…' : ''}
      </p>
    </>
  );
}

type BarProps = {
  scrolled: boolean;
  search: string;
  onSearch: () => void;
  report: (k: Known) => void;
  onSignOut: () => void;
  signingOut: boolean;
  /** Administrare's retry row (the viewer's lakes could not be read). */
  onAdminRetry: () => void;
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
 * the bar keeps its neutral placeholder meanwhile and upgrades itself from the page's own read (the
 * same promise the body waits for, itself bounded in ./session.ts), so the bar and the body agree
 * as soon as either knows. If that one is unknown too, QuietSessionRetry re-reads it.
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
  scrolled,
  search,
  onSearch,
  report,
  onSignOut,
  signingOut,
  onAdminRetry,
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
    queryKey: UNREAD_KEY,
    queryFn: () => readUnread(t),
    enabled: signedIn === true && !signingOut,
    select: (data: { count: number }) => data.count,
    staleTime: UNREAD_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: UNREAD_POLL_MS,
  });

  // Opening the notifications page is when the count changes: re-read it there.
  useEffect(() => {
    if (signedIn === true && pathname === '/notificari') void qc.invalidateQueries({ queryKey: UNREAD_KEY });
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
    // The bar's «Intră» from 768; below it (no bar) the page itself.
    const signIn = document.querySelector<HTMLElement>('header [data-sign-in]');
    const target = signIn && signIn.getClientRects().length > 0 ? signIn : document.getElementById('continut');
    target?.focus();
  }, [focusSignInRef, topBarViewer.status]);

  return (
    <TopBar
      viewer={topBarViewer}
      active={active}
      activeCurrent={activeCurrent}
      admin={admin}
      onAdminRetry={adminFailed ? onAdminRetry : undefined}
      hasUnread={!signingOut && (unread.data ?? 0) > 0}
      onSearch={onSearch}
      onSignOut={onSignOut}
      signingOut={signingOut}
      resetKey={pathname}
      scrolled={scrolled}
      // Below 768 the phone has no top bar (fish: each screen's own header, §4b rule 25).
      className="sticky top-0 z-sticky max-md:hidden"
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
 * Re-read delays for a session that stayed unknown after the full read (./session.ts): one quiet
 * router.refresh() each, then nothing — the visitor is never asked to retry (owner rule 4). A
 * refresh that answers upgrades the bar, the ☰ panel and every per-viewer slot on the page at once.
 */
const QUIET_RETRY_DELAYS_MS = [4_000, 15_000];

/**
 * Renders nothing. Reads the full session (suspends until it answers); while it is unknown, it
 * schedules the next quiet re-read. The attempt count is module-level so it survives the remount a
 * refresh may cause (the session promise is replaced); a known answer resets it.
 */
let quietAttempts = 0;
function QuietSessionRetry() {
  const router = useRouter();
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  useEffect(() => {
    if (!unknown) {
      quietAttempts = 0;
      return;
    }
    const delay = QUIET_RETRY_DELAYS_MS[quietAttempts];
    if (delay === undefined) return;
    const id = setTimeout(() => {
      quietAttempts += 1;
      router.refresh();
    }, delay);
    return () => clearTimeout(id);
  }, [unknown, viewer, router]);
  return null;
}
