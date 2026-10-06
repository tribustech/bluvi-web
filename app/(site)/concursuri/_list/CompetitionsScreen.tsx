'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdjustmentsHorizontalIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import {
  ActiveFilters,
  AsideSection,
  AsideSkeleton,
  FilterBar,
  FilterChipButton,
  FilterChipMenu,
  FilterChipToggle,
  FOCUS_RING,
  LIST_CHROME_H_VAR,
  ListEmpty,
  ListError,
  ListFooter,
  ListHeader,
  ListHeaderToggle,
  ListPage,
  ListRegion,
  ListSignInGate,
  ListSummary,
  ListToolbar,
  LiveDot,
  TextAction,
  describeError,
  pageToolClass,
  SEARCH_SHELL,
  useListUrlState,
  type ActiveFilter,
  type Choice,
  type ListTab,
} from '@/components/templates/T1';
import { signInPath } from '@/components/nav/items';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  competitionCardsInfiniteQuery,
  competitionCardsKeys,
  countActiveFilters,
  DEFAULT_COMPETITION_FILTERS,
  hasActiveFilters,
  parseCustomPeriod,
  periodChipLabel,
  periodFitsStatus,
  PULSE_CARD_PARAMS,
  selectCompetitionCards,
  type CompetitionCard,
  type CompetitionCardsScope,
  type CompetitionCardStatus,
  type CompetitionFilterValues,
  type CompetitionsCommittedSearch,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { logFiltersApplied, logScopeChanged, logSearchCommitted, logStatusChanged } from './analytics';
import { PosterGrid, PosterGridSkeleton } from './cards/PosterCard';
import type { PhotoRequest } from './cards/parts';
import { FiltersDialog, periodChoices, PickerRow, type FiltersView } from './FiltersDialog';
import { DesktopRowsSkeleton, DesktopTabView } from './desktop/DesktopTabView';
import type { DesktopViewer } from './desktop/data';
import { PhotoViewer } from './PhotoViewer';
import {
  countLabel,
  FORMAT_LABEL,
  headingFor,
  isResultsMode,
  listParamsFor,
  mixedCountLabel,
  pathFor,
  ALL_STATES_PARAM,
  REGISTERED_PARAMS,
  resultsLabelFor,
  searchUrlValues,
  showsPulse,
  STATUS_CHIP,
  STATUS_WORD,
  TAB_LABEL,
  type ListPlace,
  type Status,
} from './place';
import { ResultsChrome } from './ResultsChrome';
import { RESULTS_REFRESH, RESULTS_STACK } from './resultsChromeStyles';
import { SearchDialog } from './SearchDialog';
import { StatusTabs } from './StatusTabs';
import { TAB_MODULES, type TabViewProps } from './tabs';

/*
 * Concursuri — fish app/(app)/(tabs)/competitions/index.tsx on T1 (parity competitions-list.index,
 * .cards, .pulse). Data only through core/ (the same factories and keys as fish).
 *
 * Web adaptations, each named where it happens:
 *  - the fish fixed chrome (title + tabs over the scrolling list, a short fade under it) is a sticky
 *    band under the top bar below 1280 — following the top bar up to the edge when it slides away
 *    on a phone (the shared shell offset, as T4 / T5); from 1280 the top bar's ⌘K search
 *    is always on screen, so the header scrolls with the page;
 *  - the filters are a horizontal bar over the results (owner rule 2, ROADMAP §4b): «Filtre» with
 *    the active count opens the whole dialog, quick chips (Perioadă, Format, Locuri libere, Județ —
 *    plus Stare in results mode, where the tabs are gone) apply in one tap; the left column the
 *    filters used to take goes to the cards (three 280px cards in the 872 centre at 1280);
 *  - pull-to-refresh is the kit's stand-in (DashboardRefresh, as on Acasă): «Reîmprospătează» in
 *    the header, its outcome announced, the spinner its own (never a tab switch's);
 *  - the cards are fish's POSTER cards at every width (./cards/PosterCard; owner, 2026-10-06 — no
 *    «Listă» / «Afiș» toggle), one column on the phone as in fish;
 *  - each status tab fills its own content slots (./tabs: Top above the search row, Body as the
 *    list) — the page keeps the header, tabs, search, filters, summary, states and load-more;
 *  - each tab is a page of its own (/concursuri/viitoare · /live · /rezultate; /concursuri opens on
 *    Live when something is live, else Viitoare): the tabs are real links, a switch happens in
 *    place and the list mirrors its tab into the path (search, filters, scope stay in the query);
 *  - the aside (registrations, what is live / starting / just finished) docks from 1280 (three
 *    columns, ROADMAP §4) and sits under the list below it (ListPage asideInline «end»), its rows
 *    auto-filling the width there, never dropped.
 */

/** fish LIVE_POLL_MS: the Live tab polls; nothing else does. */
const LIVE_POLL_MS = 60_000;


const REGION_ID = 'concursuri-lista';
const FILTERS_LABEL = 'Filtre concursuri';
const TITLE_ID = 'concursuri-titlu';
const SUMMARY_ID = 'concursuri-lista-titlu';
/** Results mode: the list's own heading («Rezultate pentru „…”») is the answer's — the summary's h2. */
const RESULTS_HEADING_ID = SUMMARY_ID;

export function CompetitionsScreen({
  initial,
  indexTab = null,
  isAuthenticated,
  viewer = null,
  transport,
  mirrorPath = true,
}: {
  initial: ListPlace;
  /** Opened at /concursuri: the tab it stands for (the server's pick); null on a tab's own page. */
  indexTab?: CompetitionCardStatus | null;
  /** Signed in, or a session the server could not read in time (the per-user reads still go through /api/cms). */
  isAuthenticated: boolean;
  /** Who is signed in (the server's session read): the desktop views' «tu», followed faces and my stand. */
  viewer?: DesktopViewer;
  /**
   * Dev demo only (/dev/templates/t1): the template demo renders THIS screen over a fixture
   * transport that forces its states, so approving the demo approves the shipped page.
   */
  transport?: Transport;
  /** Mirror the tab into the path (/concursuri/live). Off on the dev demo, which has its own path. */
  mirrorPath?: boolean;
}) {
  const t = useMemo(() => transport ?? createBrowserTransport(), [transport]);
  const session = { isAuthenticated };
  const qc = useQueryClient();
  const router = useRouter();

  const [status, setStatus] = useState<Status>(initial.status);
  const [scope, setScope] = useState<CompetitionCardsScope>(initial.scope);
  const [search, setSearch] = useState<CompetitionsCommittedSearch>(initial.search);
  const [filters, setFilters] = useState<CompetitionFilterValues>(initial.filters);
  // /concursuri keeps its clean URL while the list stays on the tab it opened on (pathFor).
  const [onIndex, setOnIndex] = useState<CompetitionCardStatus | null>(
    indexTab !== null && !isResultsMode(initial) && initial.status === indexTab ? indexTab : null,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Which view the filters dialog opens on: the whole sheet, or (from a quick chip) a sub-view.
  const [filtersEntry, setFiltersEntry] = useState<FiltersView>('filters');
  const [searchOpen, setSearchOpen] = useState(false);
  // Where leaving results returns to. A reloaded filtered «Urmărite» list goes back to «Urmărite».
  const [before, setBefore] = useState<{ scope: CompetitionCardsScope; status: CompetitionCardStatus }>({
    scope: initial.scope === 'followed' ? 'followed' : 'all',
    status: 'notStarted',
  });
  const [photo, setPhoto] = useState<PhotoRequest | null>(null);
  // «Today» for the period presets, the chips, the calendar and the period-vs-state check (filters.c4).
  // Read once for a hydration-stable first render, then again whenever the page comes back into view
  // and on every filters opening (fish recomputes per sheet opening): a tab left open past midnight,
  // a weekend or a month never offers yesterday's presets.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const mineActive = scope === 'registered';
  const place: ListPlace = { status, scope, search, filters };
  const resultsMode = isResultsMode(place);

  // The list's place lives in the URL (T1): reload, back from a competition and a shared link return to it.
  // The tab is the path (pathFor); `stare=toate` only outside results mode: «Orice stare» applied
  // from the filters is fish's tab-less «Toate concursurile» list (filters.c15); in results mode
  // every state is /concursuri's default.
  const listPath = pathFor(place, onIndex);
  const urlValues = {
    [ALL_STATES_PARAM.key]: !resultsMode && status === 'all' ? ALL_STATES_PARAM.value : null,
    scope: scope === 'all' ? null : scope,
    ...searchUrlValues(search),
    period: filters.period === 'all' ? null : filters.period,
    format: filters.format === 'all' ? null : filters.format,
    availableOnly: filters.availableOnly ? 'true' : null,
    // The older spelling, cleared once the list writes its own.
    available: null,
    countyId: filters.countyId,
    countyName: filters.countyId ? filters.countyName : null,
  };
  useListUrlState(urlValues, { pathname: mirrorPath ? listPath : undefined });

  // Focus to restore after a commit that unmounts the focused control.
  // A new object per request, so asking for the same target twice still moves focus.
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  useEffect(() => {
    if (focusRequest) document.getElementById(focusRequest.id)?.focus();
  }, [focusRequest]);

  /* ---------------- reads ---------------- */

  const params = listParamsFor(place);
  // fish pollLive (index.tsx:211): Live, not Ale mele — results narrowed to Live poll too; TanStack
  // pauses it while the page is hidden.
  const pollLive = status === 'started' && !mineActive;
  const list = useInfiniteQuery(competitionCardsInfiniteQuery(t, params, session, { refetchInterval: pollLive ? LIVE_POLL_MS : false }));
  const sel = selectCompetitionCards(list.data, params, session);

  const registered = useInfiniteQuery(competitionCardsInfiniteQuery(t, REGISTERED_PARAMS, session));
  const regSel = selectCompetitionCards(registered.data, REGISTERED_PARAMS, session);
  const regCounts = regSel.counts;
  const registeredAhead = regCounts ? regCounts.notStarted + regCounts.started : 0;
  const registeredTotal = regCounts ? regCounts.notStarted + regCounts.started + regCounts.completed : 0;

  // Viitoare, unfiltered: the tab's own promo blocks (./tabs/UpcomingTab) sit over the list.
  const showPulse = showsPulse(place);

  /* ---------------- actions ---------------- */

  const changeStatus = (next: Status) => {
    setStatus(next);
    if (next !== status) setOnIndex(null);
    // Picking a status tab is how you leave «Ale mele» (fish changeStatus).
    setScope((s) => (s === 'registered' ? 'all' : s));
    if (next !== 'all') logStatusChanged({ status: next, scope });
  };
  const toggleScope = (target: 'registered' | 'followed') => {
    const next = scope === target ? 'all' : target;
    setScope(next);
    logScopeChanged({ scope: next });
  };

  // fish commitSearch (results.c2): remember where the user was, then every state under scope all.
  const commitSearch = (committed: NonNullable<CompetitionsCommittedSearch>) => {
    if (!resultsMode) setBefore({ scope, status: status === 'all' ? before.status : status });
    else if (status !== 'all') setBefore((b) => ({ ...b, status: status as CompetitionCardStatus }));
    setSearch(committed);
    setScope('all');
    setStatus('all');
    setSearchOpen(false);
    // The opener (the search pill) is gone in results mode: the answer's heading takes focus.
    setFocusRequest({ id: RESULTS_HEADING_ID });
    logSearchCommitted(committed);
  };

  // results.c5: back clears search and filters and restores the scope and status from before.
  const exitResults = (focusTitle = false) => {
    if (focusTitle) setFocusRequest({ id: TITLE_ID });
    setSearch(null);
    setFilters(DEFAULT_COMPETITION_FILTERS);
    setScope(before.scope);
    setStatus(before.status);
  };

  /**
   * fish onApply (filters.c15, results.c6): filters and status commit together. Filtering is a status
   * change (it leaves «Ale mele», keeps «Urmărite», which stays the scope to return to). A state the
   * period cannot describe sends the period back to «Oricând» (filters.c4 — the quick chips apply
   * as they go, so it is checked here too).
   *
   * `restore` (a chip ✕, «Șterge tot», the bar's «Resetează»): back at nothing narrowing and no
   * state picked, the list returns to the tab it came from. An explicit apply never does — «Orice
   * stare» applied is fish's «Toate concursurile» across every state, as the dialog's count promised.
   * `log`: only an apply logs competitions_filters_applied (fish: the chips log nothing). `focus`:
   * the control that applied is about to unmount when the screen changes mode (the toolbar's
   * «Filtre», the last chip) — the list's heading takes focus then, never <body>.
   */
  const applyFilters = (
    input: CompetitionFilterValues,
    nextStatus: Status = status,
    { log = true, restore = false, focus = false }: { log?: boolean; restore?: boolean; focus?: boolean } = {},
  ) => {
    const next = nextStatus !== status && !periodFitsStatus(input.period, nextStatus, now) ? { ...input, period: 'all' } : input;
    if (!resultsMode) setBefore({ scope: scope === 'followed' ? 'followed' : 'all', status: status === 'all' ? before.status : status });
    setFilters(next);
    setScope((s) => (s === 'registered' ? 'all' : s));
    const backToTab = restore && search === null && !hasActiveFilters(next) && nextStatus === 'all';
    if (backToTab) {
      setScope(before.scope);
      setStatus(before.status);
    } else {
      setStatus(nextStatus);
      if (nextStatus !== status) setOnIndex(null);
      // fish onApply → changeStatus logs the state (b.analytics); a chip clearing it does not.
      if (log && nextStatus !== 'all' && nextStatus !== status) logStatusChanged({ status: nextStatus, scope });
    }
    const nextResults = search !== null || hasActiveFilters(next);
    if (focus && nextResults !== resultsMode) setFocusRequest({ id: SUMMARY_ID });
    if (log) logFiltersApplied(next);
  };

  // filters.c1: every opening starts from the committed set (the dialog resets its draft).
  const openFilters = (entry: FiltersView = 'filters') => {
    setNow(new Date());
    setFiltersEntry(entry);
    setFiltersOpen(true);
  };
  const openSearch = () => setSearchOpen(true);

  // fish onRefresh: the list is the gesture's visible leg; every other card list (the tabs' own
  // blocks, the spotlight people under the same root) re-reads underneath it. A failed
  // re-read over cards on screen is said by the stale strip (or the list's error card) — 'reported',
  // so DashboardRefresh does not announce it a second time.
  const refresh = async (): Promise<RefreshResult> => {
    void qc.invalidateQueries({ queryKey: competitionCardsKeys.root });
    const r = await list.refetch();
    return r.isError ? 'reported' : true;
  };
  // The stale strip's own retry (a failed Live poll).
  const [retryingStale, setRetryingStale] = useState(false);
  const retryStale = () => {
    if (retryingStale) return;
    setRetryingStale(true);
    void list.refetch().finally(() => setRetryingStale(false));
  };

  const retriedRef = useRef(false);
  const retry = () => {
    retriedRef.current = true;
    void qc.refetchQueries({ type: 'active' });
  };

  // fish ErrorScreen «Deconectează-te» — the one fix for a dead session.
  const [signingOut, startSignOut] = useTransition();
  const signOut = () => {
    if (signingOut) return;
    startSignOut(async () => {
      const ok = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then((r) => r.ok)
        .catch(() => false);
      if (!ok) return;
      qc.clear();
      startSignOut(() => router.refresh());
    });
  };

  /* ---------------- per-list scroll memory (c20) ---------------- */

  const listKey = resultsMode ? 'results' : `${scope}:${status}`;
  const offsets = useRef<Record<string, number>>({});
  const lastScroll = useRef(0);
  const previousKey = useRef(listKey);
  useEffect(() => {
    const onScroll = () => {
      lastScroll.current = window.scrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    const previous = previousKey.current;
    if (previous === listKey) return;
    // Results are a new question every time: never remembered, always from the top.
    if (previous !== 'results') offsets.current[previous] = lastScroll.current;
    previousKey.current = listKey;
    const target = listKey === 'results' ? 0 : (offsets.current[listKey] ?? 0);
    window.scrollTo({ top: target, behavior: 'instant' });
  }, [listKey]);

  /* ---------------- header ---------------- */

  // «Locuri libere»: the CMS filters each page but counts the unfiltered set (competition-cards.ts,
  // deliberate) — its total is not this list's. Only the loaded count is true, once every page is in.
  const totalUnknown = filters.availableOnly;
  const total = totalUnknown ? (list.hasNextPage ? null : sel.competitions.length) : sel.total;
  const heading = headingFor(place);
  const countText =
    total === null || (resultsMode && total === 0)
      ? undefined
      : mineActive || status === 'all'
        ? mixedCountLabel(total)
        : countLabel(total, status);
  // fish CompetitionsStatusControl liveCount: the current list response's counts.started (c3).
  const liveDot = (sel.counts?.started ?? 0) > 0;

  // Badges (§4b.20): the list response's per-status counts — the same filters with the status
  // dropped (CMS competition-cards). Unknown → no badge (§4b.4): before the first answer, while a
  // previous question's list stands in, in Ale mele (its counts are the registered scope's), and
  // Viitoare under «Locuri libere» (the counts ignore that filter, deliberately).
  const tabCounts = !mineActive && !list.isPlaceholderData ? sel.counts : undefined;
  const statusTab = (key: CompetitionCardStatus, extra?: Partial<ListTab<CompetitionCardStatus>>): ListTab<CompetitionCardStatus> => {
    const count = key === 'notStarted' && filters.availableOnly ? undefined : tabCounts?.[key];
    return {
      key,
      label: TAB_LABEL[key],
      // A real link to the tab's own page (crawlers, new tab); a plain click switches in place.
      href: routes.competitions(key),
      count,
      accessibleLabel: count ? `${TAB_LABEL[key]}, ${count}` : undefined,
      ...extra,
    };
  };
  const tabs: ListTab<CompetitionCardStatus | 'mine'>[] = [
    statusTab('notStarted'),
    statusTab('started', { leading: liveDot ? <LiveDot /> : undefined }),
    statusTab('completed'),
    ...(registeredTotal > 0
      ? [
          {
            key: 'mine' as const,
            label: 'Ale mele',
            href: `${listPath}?scope=registered`,
            count: registeredAhead,
            accessibleLabel: registeredAhead > 0 ? `Ale mele, ${registeredAhead}` : 'Ale mele',
          },
        ]
      : []),
  ];
  // Asked for (?scope=registered) and settled at zero: the place does not exist — back to the public list.
  if (mineActive && isAuthenticated && registered.isSuccess && registeredTotal === 0) setScope('all');
  const activeTab = mineActive ? ('mine' as const) : status === 'all' ? undefined : status;
  const activeTabShown = !resultsMode && activeTab !== undefined && tabs.some((tab) => tab.key === activeTab);

  // A new question (entering results, another search) is never answered with the previous list's
  // cards while it reads: the bones, as a first load. Placeholder data stays for a tab switch
  // (index.s8) and for refining the same results (a filter, a state).
  const questionKey = resultsMode ? JSON.stringify(search) : null;
  const [answeredKey, setAnsweredKey] = useState(questionKey);
  if (!list.isPlaceholderData && list.data && answeredKey !== questionKey) setAnsweredKey(questionKey);
  const newQuestion = list.isPlaceholderData && answeredKey !== questionKey;
  // A page emptied by «Locuri libere» with more pages behind it is not the empty state yet.
  const pageEmptiedLocally = sel.competitions.length === 0 && Boolean(list.hasNextPage) && list.isSuccess;
  const loading = list.isLoading || newQuestion || pageEmptiedLocally;
  const competitions: CompetitionCard[] = newQuestion ? [] : sel.competitions;
  const failed = list.isError && competitions.length === 0;
  // A re-read (the Live poll, «Reîmprospătează») that failed over cards already shown: they stay, but
  // marked as not current — never old LIVE figures passed off as live.
  const stale = list.isRefetchError && competitions.length > 0;
  const busy = list.isPlaceholderData && list.isFetching && !newQuestion;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (pageEmptiedLocally && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [pageEmptiedLocally, hasNextPage, isFetchingNextPage, fetchNextPage]);
  const countBusy = loading || busy;
  const showData = !loading && !failed && !sel.requiresSignIn && competitions.length > 0;

  /* The search row's stand-ins (c9): when the row has scrolled under the sticky chrome, a magnifier
     and the filters tool fade into the title row; the two pairs are never interactive together.
     «Under» is measured against the chrome's own bottom edge, wherever it is (under the top bar, or
     at the top once the bar slid away), never a fixed offset. */
  const toolbarRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [toolsTucked, setToolsTucked] = useState(false);
  useEffect(() => {
    if (resultsMode) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const row = toolbarRef.current;
      const chrome = chromeRef.current;
      if (!row || !chrome) return;
      setToolsTucked(row.getBoundingClientRect().bottom <= chrome.getBoundingClientRect().bottom);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The chrome moves on its own when the top bar slides (its `top` transition).
    const chrome = chromeRef.current;
    chrome?.addEventListener('transitionend', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      chrome?.removeEventListener('transitionend', schedule);
    };
  }, [resultsMode]);
  const tucked = toolsTucked && !resultsMode;
  // The pinned chrome's height, for what docks under it (the T1 aside's sticky top, LIST_CHROME_H_VAR).
  useEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty(LIST_CHROME_H_VAR, `${Math.round(chrome.offsetHeight)}px`));
    ro.observe(chrome);
    return () => {
      ro.disconnect();
      root.style.removeProperty(LIST_CHROME_H_VAR);
    };
  }, [resultsMode]);

  /*
   * The filter bar sits over the list, after the bento (owner review 2026-10-06). A chip that flips
   * the page into results mode (or back) removes the bento above the bar: the page scrolls by what
   * moved, so the bar — and the chip just used — stays under the pointer (as far as the page can
   * scroll; at the very top it lands right under the header, over its results).
   */
  const barRef = useRef<HTMLDivElement>(null);
  const barTop = useRef<number | null>(null);
  const holdBar = () => {
    barTop.current = barRef.current?.getBoundingClientRect().top ?? null;
  };
  const lastResults = useRef(resultsMode);
  useLayoutEffect(() => {
    if (lastResults.current === resultsMode) return;
    lastResults.current = resultsMode;
    const before = barTop.current;
    barTop.current = null;
    const root = document.documentElement;
    root.style.removeProperty('min-height');
    const now = barRef.current?.getBoundingClientRect().top;
    if (before == null || now == null || !barRef.current?.offsetParent) return;
    const target = window.scrollY + now - before;
    if (Math.abs(now - before) <= 1 || target < 0) return;
    // A short answer (a few results) may leave the page too short to scroll that far: the page
    // keeps the room until the next mode change, so the bar never jumps up under the pointer.
    const need = target + window.innerHeight;
    if (need > root.scrollHeight) root.style.minHeight = `${Math.ceil(need)}px`;
    window.scrollTo({ top: target, behavior: 'instant' });
  }, [resultsMode]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('min-height');
    },
    [],
  );
  const filterCount = (resultsMode && status !== 'all' ? 1 : 0) + countActiveFilters(filters);
  const followedOn = scope === 'followed';

  /* ---------------- results chips (results.c7, c8) ---------------- */

  // A chip ✕ undoes its one choice, logs nothing (fish CompetitionFilterChips), and may end results
  // mode — the rail is gone then, so the heading takes focus (ActiveFilters' own fallback unmounts).
  const clear = (next: CompetitionFilterValues, nextStatus: Status = status) => applyFilters(next, nextStatus, { log: false, restore: true, focus: true });
  const chips = ([
    resultsMode && status !== 'all'
      ? { key: 'status', label: STATUS_CHIP[status], leading: status === 'started' ? <LiveDot /> : undefined, onClear: () => clear(filters, 'all') }
      : null,
    filters.availableOnly ? { key: 'available', label: 'Locuri libere', onClear: () => clear({ ...filters, availableOnly: false }) } : null,
    filters.countyId
      ? { key: 'county', label: filters.countyName ?? 'Județ', onClear: () => clear({ ...filters, countyId: null, countyName: null }) }
      : null,
    filters.period !== 'all'
      ? { key: 'period', label: periodChipLabel(filters.period, now), onClear: () => clear({ ...filters, period: 'all' }) }
      : null,
    filters.format !== 'all' ? { key: 'format', label: FORMAT_LABEL[filters.format], onClear: () => clear({ ...filters, format: 'all' }) } : null,
  ] as (ActiveFilter | null)[]).filter((c): c is ActiveFilter => c !== null);
  // fish «Șterge tot»: every filter and the status (the search stays).
  const clearAll = () => clear(DEFAULT_COMPETITION_FILTERS, 'all');

  // What the pill says: the search, else that the list is filtered — and, filtered on «Urmărite»
  // (results.c6 keeps the scope), that it is still the followed list.
  const resultsLabel = resultsLabelFor(place);
  // Below 768 the refresh takes the back square's framing (RESULTS_REFRESH); from 768 the labelled tool.
  const refreshTool = (
    <span className={RESULTS_REFRESH}>
      <DashboardRefresh onRefresh={refresh} />
    </span>
  );
  // The header's reserved band from 1280 (results mode): the answer's size, as the list says it.
  const bandText = sel.requiresSignIn || failed
    ? heading
    : countBusy
      ? 'Se caută…'
      : total === 0
        ? 'Niciun rezultat'
        : (countText ?? heading);

  const header = resultsMode ? (
    <div
      ref={chromeRef}
      data-list-chrome=""
      className={cn(
        // fish's results chrome is fixed over the list: below 1280 it is sticky under the top bar,
        // on the page ground, with the same short fade as the browse chrome — and the browse
        // header's top inset, so it never sits flush on the edge once the phone's bar slides away.
        'sticky z-sticky -mx-4 bg-page px-4 pt-2 md:-mx-6 md:px-6',
        RESULTS_STACK,
        UNDER_BAR_TOP,
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:from-page after:to-transparent after:content-['']",
        // From 1280 the chrome is in the centre column (below), where the index has its search row.
        'xl:static xl:mx-0 xl:p-0 xl:after:hidden',
      )}
    >
      {/* The page's h1 stays «Concursuri» (the site section); the answer is the list's heading.
          Below 1280 it is spoken only (the results chrome takes the title row, as fish's). From 1280
          the T1 header stays on screen, its tab band reserved and carrying the answer, so entering
          results from the live-apply column never pulls the column up under the pointer. */}
      <ListHeader titleId={TITLE_ID} title="Concursuri" reserveBelow={bandText} className="max-xl:sr-only" />
      <div className="contents xl:hidden">
        <ResultsChrome
          label={resultsLabel}
          filterCount={filterCount}
          onBack={() => exitResults(true)}
          onPressLabel={() => (search ? openSearch() : openFilters())}
          onOpenFilters={() => openFilters()}
          filtersExpanded={filtersOpen}
          trailing={refreshTool}
        />
        {/* From 1280 the filter bar's chips show every choice: no rail there. */}
        <ActiveFilters
          filters={chips}
          onClearAll={clearAll}
          fallbackFocusIds={[RESULTS_HEADING_ID, TITLE_ID]}
          itemLabel={(l) => `${l}. Apasă pentru a renunța la acest filtru`}
          className="xl:hidden"
        />
      </div>
    </div>
  ) : (
    <div
      ref={chromeRef}
      data-list-chrome=""
      className={cn(
        // fish's fixed chrome — sticky under the top bar at every width (and up to the edge when the
        // phone's bar slides away, on the bar's own timing: UNDER_BAR_TOP), on the page ground, the
        // list fading into it through a short gradient (c1). From 1280 too: the same list behaves the
        // same at every width (tabs, and once the search row scrolled under it, search and «Filtre»).
        'sticky z-sticky -mx-4 bg-page px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8',
        UNDER_BAR_TOP,
        // The fade starts with a few px of solid page under the tab rule, so nothing scrolling under
        // it is legible right against the active tab's underline (c1).
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-10 after:bg-linear-to-b after:from-page after:from-25% after:to-transparent after:content-['']",
      )}
    >
      <ListHeader
        titleId={TITLE_ID}
        title="Concursuri"
        actions={
          <>
            <span
              inert={!tucked || undefined}
              // Out of the layout until the row is tucked (the phone's title row holds three tools, as
              // fish's), then faded in; never interactive together with the row (inert).
              className={cn(
                'gap-2 opacity-100 transition-[opacity,display] transition-discrete duration-(--duration-fast) ease-fast starting:opacity-0',
                tucked ? 'flex' : 'hidden',
              )}
            >
              <button
                type="button"
                aria-label="Caută concursuri"
                aria-haspopup="dialog"
                onClick={openSearch}
                className={pageToolClass({ pressed: false })}
              >
                <MagnifyingGlassIcon aria-hidden />
              </button>
              <button
                type="button"
                aria-label={filterCount > 0 ? `Filtre, ${filterCount} active` : 'Filtre'}
                aria-haspopup="dialog"
                onClick={() => openFilters()}
                className={pageToolClass({ pressed: filterCount > 0 })}
              >
                <AdjustmentsHorizontalIcon aria-hidden />
              </button>
            </span>
            {/* Phone: while the search tools are tucked into the row, the refresh waits at the top
                (the title row holds three tools, as fish's). */}
            <span className={cn('contents', tucked && 'max-md:hidden')}>
              <DashboardRefresh onRefresh={refresh} />
            </span>
            <ListHeaderToggle
              label={followedOn ? 'Toate concursurile' : 'Concursuri urmărite'}
              icon={<EyeIcon aria-hidden />}
              pressed={followedOn}
              onToggle={() => toggleScope('followed')}
            />
          </>
        }
        below={
          <StatusTabs
            label="Stare concursuri"
            tabs={tabs}
            active={activeTab}
            controls={REGION_ID}
            onSelect={(k) => (k === 'mine' ? toggleScope('registered') : changeStatus(k))}
          />
        }
      />
    </div>
  );

  /* ---------------- filters (the bar over the results, the dialog for everything) ---------------- */

  const statusChoices: Choice<Status>[] = [
    { value: 'all', label: 'Orice stare' },
    { value: 'notStarted', label: 'Viitoare' },
    { value: 'started', label: 'Live', leading: <LiveDot /> },
    { value: 'completed', label: 'Încheiate' },
  ];
  const formatChoices: Choice<CompetitionFilterValues['format']>[] = [
    { value: 'all', label: 'Orice format' },
    { value: 'single', label: 'Individual' },
    { value: 'team', label: 'Echipe' },
  ];
  const customRange = parseCustomPeriod(filters.period);

  // The chips apply as they are picked (the old docked column's live-apply); Județ and «Alege din
  // calendar» open the dialog's sub-view, whose pick applies at once.
  const filterBar = (
    <FilterBar
      label={FILTERS_LABEL}
      count={filterCount}
      onOpenFilters={() => openFilters()}
      expanded={filtersOpen && filtersEntry === 'filters'}
      onReset={clearAll}
      canReset={chips.length > 0}
    >
      <FilterChipMenu
        label="Perioadă"
        name="perioada"
        options={periodChoices(filters.period, status, now)}
        value={filters.period}
        defaultValue="all"
        chosenLabel={customRange ? periodChipLabel(filters.period, now) : null}
        onChange={(period) => applyFilters({ ...filters, period })}
        after={(close) => (
          <PickerRow
            compact
            label={customRange ? periodChipLabel(filters.period, now) : 'Alege din calendar'}
            accessibleLabel={customRange ? `Perioadă aleasă: ${periodChipLabel(filters.period, now)}` : 'Alege perioada din calendar'}
            active={Boolean(customRange)}
            onClick={() => {
              close();
              openFilters('range');
            }}
          />
        )}
      />
      <FilterChipMenu
        label="Format"
        name="format"
        options={formatChoices}
        value={filters.format}
        defaultValue="all"
        onChange={(format) => applyFilters({ ...filters, format })}
      />
      {/* filters.c5: free places only exist for a competition that has not started. */}
      {status === 'notStarted' ? (
        <FilterChipToggle label="Locuri libere" pressed={filters.availableOnly} onChange={(availableOnly) => applyFilters({ ...filters, availableOnly })} />
      ) : null}
      <FilterChipButton
        label="Județ"
        value={filters.countyName ?? (filters.countyId ? 'Județ selectat' : null)}
        expanded={filtersOpen && filtersEntry === 'county'}
        onClick={() => openFilters('county')}
      />
      {/* filters.c3: the state — on the index the tabs carry it; in results mode they are gone. Last
          in the row, so a chip that flips the page into results mode stays under the pointer. */}
      {resultsMode ? (
        <FilterChipMenu
          label="Stare"
          name="stare"
          options={statusChoices}
          value={status}
          defaultValue="all"
          onChange={(s) => applyFilters(filters, s)}
        />
      ) : null}
    </FilterBar>
  );

  const dialogs = (
    <>
      <FiltersDialog
        open={filtersOpen}
        entry={filtersEntry}
        onClose={() => setFiltersOpen(false)}
        values={filters}
        status={status}
        scope={scope}
        search={search}
        t={t}
        isAuthenticated={isAuthenticated}
        now={now}
        onApply={(values, nextStatus) => {
          setFiltersOpen(false);
          // From «Filtre» / the pill the opener may unmount with the mode change; from a chip (a
          // sub-view entry) the bar stays, and the dialog returns focus to the chip.
          applyFilters(values, nextStatus, { focus: filtersEntry === 'filters' });
        }}
      />
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        t={t}
        onCommit={commitSearch}
        onOpenCompetition={(id) => {
          setSearchOpen(false);
          router.push(routes.competition(id));
        }}
      />
    </>
  );

  /* ---------------- body ---------------- */

  const summaryShown = true;
  useEffect(() => {
    if (!retriedRef.current || failed || loading) return;
    retriedRef.current = false;
    document.getElementById(summaryShown ? SUMMARY_ID : TITLE_ID)?.focus();
  }, [failed, loading, summaryShown]);

  // In results mode the heading above already names the question («Rezultate pentru „…”»): the empty
  // state does not repeat it (a long label printed three times on a phone), nor the «0» count.
  const emptyTitle = resultsMode
    ? search
      ? status === 'all'
        ? 'Niciun rezultat'
        : `Niciun concurs ${STATUS_WORD[status].one}`
      : scope === 'followed'
        ? 'Niciun concurs urmărit cu aceste filtre'
        : 'Niciun concurs cu aceste filtre'
    : scope === 'followed'
      ? 'Niciun concurs urmărit aici'
      : 'Niciun concurs găsit';
  const settledEmpty =
    !sel.requiresSignIn && list.isSuccess && !busy && !loading && competitions.length === 0 && !list.hasNextPage;

  // Each status tab's own content (./tabs): browsing a tab — not results mode, not «Ale mele», not
  // the tab-less «Toate concursurile». «Ale mele» keeps its rows from 1024 (./desktop/MineRows).
  const tabModule = !resultsMode && !mineActive && status !== 'all' ? TAB_MODULES[status] : null;
  const tabBase: Omit<TabViewProps, 'priorityCount'> | null =
    tabModule && status !== 'all'
      ? {
          status,
          cards: competitions,
          loading,
          scope: scope === 'followed' ? 'followed' : 'all',
          t,
          viewer,
          isAuthenticated,
          onOpenPhoto: setPhoto,
          labelledBy: SUMMARY_ID,
        }
      : null;
  const tabProps: TabViewProps | null =
    tabModule && tabBase
      ? {
          ...tabBase,
          // The phone's first posters keep priority (LCP, §5) when nothing tall sits above the list;
          // a tab whose Top may render nothing (or little) says how many itself.
          priorityCount: showPulse ? 0 : tabModule.priorityCount ? tabModule.priorityCount(tabBase) : tabModule.Top ? 0 : 2,
        }
      : null;
  const TabTop = tabModule?.Top;
  const TabBody = tabModule?.Body;
  const TabSkeleton = tabModule?.Skeleton;
  const TabEmpty = tabModule?.Empty;

  let body: ReactNode;
  if (sel.requiresSignIn) {
    body = (
      <ListSignInGate
        title={scope === 'followed' ? 'Concursurile urmărite' : 'Înscrierile tale'}
        description="Intră în cont ca să vezi concursurile tale."
        // Back to this very list after signing in — its filters too, not a bare «Urmărite».
        href={signInPath(withQuery(listPath, placeQuery(urlValues)))}
      />
    );
  } else if (failed) {
    const described = describeError(list.error);
    body = (
      <ListError
        title={described.title}
        description={described.message}
        onRetry={described.canRetry ? retry : undefined}
        retrying={list.isFetching}
        attempt={list.errorUpdateCount}
        secondaryAction={
          described.showSignOut ? (
            <Button variant="outline" aria-disabled={signingOut || undefined} aria-busy={signingOut || undefined} onClick={signOut}>
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (loading) {
    body = TabSkeleton ? (
      <TabSkeleton />
    ) : mineActive ? (
      <>
        <div className="lg:hidden">
          <PosterGridSkeleton />
        </div>
        <div role="status" className="hidden lg:block">
          <span className="sr-only">Se încarcă concursurile…</span>
          <DesktopRowsSkeleton />
        </div>
      </>
    ) : (
      <PosterGridSkeleton />
    );
  } else if (competitions.length === 0 && TabEmpty && tabProps?.scope === 'all') {
    body = <TabEmpty {...tabProps} />;
  } else if (competitions.length === 0) {
    body = (
      // Results: the card spans the column, edge to edge with the pill and the heading (its text
      // keeps its own measure inside); on the index the kit's centred 720 frame.
      <div className={resultsMode ? '[&>div]:max-w-none' : 'contents'}>
        <ListEmpty
          title={emptyTitle}
          description={
            resultsMode
              ? search
                ? 'Încearcă altă stare sau caută altceva.'
                : 'Încearcă altă stare sau elimină câteva filtre.'
              : scope === 'followed'
                ? 'Salvează concursurile care te interesează sau verifică celelalte taburi.'
                : 'Schimbă tabul pentru a vedea alte concursuri.'
          }
          action={
            resultsMode ? (
              <Button variant="secondary" onClick={() => exitResults(true)}>
                {search ? 'Înapoi la concursuri' : 'Șterge filtrele'}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  } else if (TabBody && tabProps) {
    body = <TabBody {...tabProps} />;
  } else {
    const cards = <PosterGrid cards={competitions} onOpenPhoto={setPhoto} labelledBy={SUMMARY_ID} priorityCount={showPulse ? 0 : 2} />;
    body = mineActive ? (
      <>
        <div className="lg:hidden">{cards}</div>
        <div className="hidden lg:block" data-desktop-tab="mine">
          <DesktopTabView tab="mine" cards={competitions} t={t} viewer={viewer} />
        </div>
      </>
    ) : (
      cards
    );
  }

  /* ---------------- aside (≥1440) ---------------- */

  const myCards = regSel.competitions.filter((c) => c.status !== 'completed').slice(0, 3);
  const asideIsLive = status !== 'started';
  const mineBlock =
    isAuthenticated && !mineActive && myCards.length > 0 ? (
      <AsideSection key="mine" title="Înscrierile mele" action={<TextAction onClick={() => toggleScope('registered')}>Vezi toate</TextAction>}>
        <AsideList items={myCards} />
      </AsideSection>
    ) : null;
  // The same cache entries the tabs read (no extra request).
  const liveList = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, session));
  const upcomingList = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, session));
  // Results mode has no aside (fish results.c14: the list only) — «Live acum» next to an answer
  // repeated its first cards, and its «Vezi toate» narrowed the answer instead of opening Live.
  const asideNext: { title: string; target: Status; source: typeof liveList; showLive: boolean } | null = resultsMode
    ? null
    : asideIsLive
      ? { title: 'Live acum', target: 'started', source: liveList, showLive: false }
      : { title: 'Încep curând', target: 'notStarted', source: upcomingList, showLive: true };
  const asideItems = (asideNext?.source.data?.pages.flatMap((p) => p.data) ?? []).slice(0, 4);
  const nextBlock =
    asideNext && asideItems.length > 0 ? (
      <AsideSection
        key="next"
        title={asideNext.title}
        action={<TextAction onClick={() => changeStatus(asideNext.target)}>Vezi toate</TextAction>}
      >
        <AsideList items={asideItems} showLive={asideNext.showLive} />
      </AsideSection>
    ) : null;
  // The tabs and «Ale mele» use the whole width (each tab lays out its own columns): no aside with
  // them; results mode neither (results.c14).
  const noAside = resultsMode || tabModule !== null || mineActive;
  const asidePending = !noAside && ((isAuthenticated && registered.isPending) || Boolean(asideNext?.source.isPending));
  const docked = noAside ? [] : [mineBlock, nextBlock].filter(Boolean);
  const aside = asidePending ? <AsideSkeleton /> : docked.length > 0 ? <>{docked}</> : undefined;

  // results.c10: «Rezultate pentru „…”» / «Concursuri filtrate» over the count, as fish's list header.
  const summary = (
    <ListSummary
      id={SUMMARY_ID}
      busy={busy}
      // Results from 1280: the header's band shows the answer and the toggle; this row takes no space
      // and its heading stays the region's name (spoken, focusable).
      titleHiddenFrom={resultsMode ? 'xl' : undefined}
      // A long search label: two lines on the phone, the pill above carries it whole.
      title={<span className="max-md:line-clamp-2">{heading}</span>}
      count={sel.requiresSignIn || failed || countBusy ? undefined : countText}
      loading={countBusy && !sel.requiresSignIn && !failed}
    />
  );

  // Polite: a failed background poll is news, not an interruption.
  const staleNotice = (
    <div aria-live="polite" className="empty:hidden">
      {stale ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-status-warning-bg px-3 py-2 t-caption text-status-warning-fg">
          <span>Nu am putut actualiza lista.</span>
          <TextAction onClick={retryStale} disabled={retryingStale}>
            {retryingStale ? 'Se actualizează…' : 'Încearcă din nou'}
          </TextAction>
        </p>
      ) : null}
    </div>
  );

  return (
    <ListPage
      header={header}
      aside={aside}
      asideLabel="Ce se întâmplă acum"
      asideBusy={asidePending}
    >
      {/* The tab's own blocks first (./tabs): promo, not the list's chrome. */}
      {TabTop && tabProps ? <TabTop {...tabProps} /> : null}
      {/* Owner rule 6 (ROADMAP §4b): the search pill and the filter chips are ONE block, directly
          over the results they ask about. On a phone it stays at the top of the column (fish's
          order: title → tabs → search row), the bento under it. */}
      <div
        data-list-search=""
        className={cn('flex flex-col gap-3', resultsMode ? 'hidden xl:flex' : 'max-md:-order-1')}
      >
        {resultsMode ? (
          // ≥1280: the results chrome in the search row's slot, inside the centre column (T1).
          <ResultsChrome
            label={resultsLabel}
            filterCount={filterCount}
            onBack={() => exitResults(true)}
            onPressLabel={search ? openSearch : () => openFilters()}
            trailing={refreshTool}
          />
        ) : (
          <div ref={toolbarRef}>
            <ListToolbar>
              {/* search.c1: the pill opens the search dialog — typing there never filters this list. */}
              <button
                type="button"
                onClick={openSearch}
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                aria-label="Caută un concurs, o baltă sau un organizator"
                className={cn(SEARCH_SHELL, 'min-w-0 flex-1 cursor-pointer gap-2.5 pl-3.5 text-left hover:bg-soft-fill!', FOCUS_RING)}
              >
                <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate t-body text-muted">Concurs, baltă sau organizator</span>
              </button>
            </ListToolbar>
          </div>
        )}
        {/* ONE bar in both modes, so a chip that enters (or leaves) results mode keeps focus. In
            results mode below 1280 the sticky chrome has the filters circle and the chip rail instead. */}
        <div
          ref={barRef}
          onPointerDownCapture={holdBar}
          onKeyDownCapture={holdBar}
          onFocusCapture={holdBar}
          className={resultsMode ? 'hidden xl:block' : undefined}
        >
          {filterBar}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {settledEmpty ? emptyTitle : ''}
      </p>
      <ListRegion
        id={REGION_ID}
        tabpanel={activeTabShown}
        labelledBy={activeTabShown ? `${REGION_ID}-tab-${activeTab}` : summaryShown ? SUMMARY_ID : TITLE_ID}
        busy={busy}
      >
        {summary}
        {staleNotice}
        {body}
        {showData ? (
          <ListFooter
            hasMore={Boolean(list.hasNextPage)}
            loadingMore={list.isFetchingNextPage}
            error={list.isFetchNextPageError}
            errorLabel="Nu am putut încărca mai multe concursuri."
            onLoadMore={() => {
              if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
            }}
            shown={competitions.length}
            total={totalUnknown ? undefined : (total ?? undefined)}
            noun="concursuri"
          />
        ) : null}
      </ListRegion>
      {dialogs}
      <PhotoViewer
        photo={photo}
        onClose={() => setPhoto(null)}
        onOpenCompetition={(id) => {
          setPhoto(null);
          router.push(routes.competition(id));
        }}
      />
    </ListPage>
  );
}

/** The list's place as a query string — the URL useListUrlState writes (a sign-in comes back to it). */
function placeQuery(values: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) q.set(k, v);
  return q.toString();
}

const withQuery = (path: string, query: string) => (query ? `${path}?${query}` : path);

/**
 * The aside's compact rows. `showLive` marks LIVE rows (off when the block is the live list). Docked
 * (≥1280) they stack; inline under the list they auto-fill the block's width (260px minimum: two
 * columns at 768, more on a wider block) instead of one narrow column in a wide card.
 */
function AsideList({ items, showLive = true }: { items: CompetitionCard[]; showLive?: boolean }) {
  return (
    <ul className="-mx-2 grid grid-cols-1 gap-x-6 md:grid-cols-[repeat(auto-fill,minmax(--spacing(65),1fr))] xl:flex xl:flex-col">
      {items.map((c) => {
        const img = c.banner?.smallUrl ?? c.banner?.url ?? c.lake?.image?.smallUrl ?? c.lake?.image?.url;
        return (
          <li key={c.documentId}>
            <Link href={routes.competition(c.documentId)} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-soft-fill">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
                {img ? <Image src={img} alt="" fill sizes="40px" className="object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 t-body-strong text-ink">{c.name}</span>
                <span className="block truncate t-caption text-muted">
                  {c.dateLabel}
                  {c.lake ? ` · ${c.lake.name}` : ''}
                </span>
              </span>
              {showLive && c.status === 'started' ? <StatusPill tone="live">LIVE</StatusPill> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The page's loading frame (Suspense fallback): the bones of the tab's list (its module's Skeleton), else the poster grid's. */
export function CompetitionsFallbackBody({ tab }: { tab?: CompetitionCardStatus }) {
  const Skeleton = tab ? TAB_MODULES[tab].Skeleton : PosterGridSkeleton;
  return <Skeleton />;
}
