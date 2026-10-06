'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, ListBulletIcon, PlusIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import {
  ActiveFilters,
  ASIDE_INLINE,
  AsideSection,
  AsideSkeleton,
  ChoiceChips,
  FilterButton,
  FilterColumn,
  FilterSection,
  FiltersSurface,
  FilterSwitch,
  ListEmpty,
  ListError,
  ListFooter,
  ListGrid,
  ListHeader,
  ListHeaderToggle,
  ListPage,
  ListRegion,
  ListRows,
  ListSearch,
  ListSignInGate,
  ListSkeleton,
  ListSummary,
  ListTabs,
  ListToolbar,
  LiveDot,
  StickyActions,
  TextAction,
  ViewToggle,
  useListUrlState,
  type ActiveFilter,
  type Choice,
  type ListTab,
} from '@/components/templates/T1';
import { Button, ButtonLink } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  competitionCardsInfiniteQuery,
  countActiveFilters,
  DEFAULT_COMPETITION_FILTERS,
  featuredCompetitionQuery,
  hasActiveFilters,
  PULSE_CARD_PARAMS,
  pulseCountTile,
  pulsePersonQuery,
  periodChipLabel,
  periodOptions,
  selectCompetitionCards,
  type CompetitionCard,
  type CompetitionCardsScope,
  type CompetitionCardStatus,
  type CompetitionFilterValues,
  type CompetitionsCommittedSearch,
} from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CompetitionPoster, CompetitionRow, CompetitionRowsHead, competitionImage, statusLook, type RowEnd } from './CompetitionItems';
import { createDemoTransport, DEMO_DEADLINE_MS, demoKey, runsInsideDeadline, withDeadline } from './demoTransport';
import {
  headingFor,
  initialFromUrl,
  isResultsMode,
  listParamsFor,
  REGISTERED_PARAMS,
  rowEndFor,
  showsPulse,
  type Density,
  type Status,
  type UrlParams,
} from './demoInitial';
import { describeError } from '@/components/templates/T1/describeError';
import { PulseHero, PulseHeroSkeleton } from './PulseHero';
import { DEMO_PATH, type DemoState } from './StateSwitcher';

/*
 * T1 demo — fish (tabs)/competitions/index.tsx on the template, with REAL data from the local CMS
 * through core/ (competitionCardsInfiniteQuery & co., the same factories and keys as fish). Outages
 * (loading / empty / error / a failing next page) are forced in the transport (demoTransport.ts),
 * so the whole page reacts as in production; the other `state`s only pick the starting tab, search,
 * filters or density. Everything else is real.
 */

/** fish: the Live tab polls (roughly a minute); nothing else does. */
const LIVE_POLL_MS = 60_000;

/** Romanian agrees the adjective with the noun: un concurs viitor, două viitoare. */
const STATUS_WORD: Record<CompetitionCardStatus, { one: string; many: string }> = {
  notStarted: { one: 'viitor', many: 'viitoare' },
  started: { one: 'în desfășurare', many: 'în desfășurare' },
  completed: { one: 'încheiat', many: 'încheiate' },
};

const TAB_LABEL: Record<CompetitionCardStatus, string> = { notStarted: 'Viitoare', started: 'Live', completed: 'Rezultate' };
const STATUS_CHIP: Record<CompetitionCardStatus, string> = { notStarted: 'Viitoare', started: 'Live', completed: 'Încheiate' };
const FORMAT_LABEL = { single: 'Individual', team: 'Echipe' } as const;

/** «20 de concursuri viitoare» — the shared plural rule (20+ takes «de»). */
function nounCount(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return `${n} ${n !== 0 && (rest === 0 || rest >= 20) ? 'de ' : ''}${many}`;
}

function countLabel(count: number, status: CompetitionCardStatus): string {
  const word = count === 1 ? STATUS_WORD[status].one : STATUS_WORD[status].many;
  return `${nounCount(count, 'concurs', 'concursuri')} ${word}`;
}

const mixedCountLabel = (count: number) => nounCount(count, 'concurs', 'concursuri');

/** ?state=crash: throws while rendering, to show the route's error boundary (error.tsx). */
function Crash(): never {
  throw new Error('Eroare de randare forțată (demo T1, ?state=crash).');
}

export function CompetitionsDemo({
  state,
  isAuthenticated,
  url = {},
}: {
  state: DemoState;
  isAuthenticated: boolean;
  /** The page's searchParams: the list's place survives a reload, a back, a shared link. */
  url?: UrlParams;
}) {
  // The browser reads carry a deadline: a hung CMS ends in the error state, not skeletons forever.
  // ?state=slow builds it inside-out — the hang runs UNDER a short deadline — so that path is real.
  const t = useMemo(() => {
    if (!runsInsideDeadline(state)) return createDemoTransport(withDeadline(createBrowserTransport()), state);
    const demo = createDemoTransport(createBrowserTransport(), state);
    return { ...withDeadline(demo, DEMO_DEADLINE_MS), heal: demo.heal };
  }, [state]);
  const session = { isAuthenticated };
  const [init] = useState(() => initialFromUrl(state, url));
  const qc = useQueryClient();
  const router = useRouter();

  const [status, setStatus] = useState<Status>(init.status);
  const [scope, setScope] = useState<CompetitionCardsScope>(init.scope);
  const [search, setSearch] = useState<CompetitionsCommittedSearch>(init.search);
  const [filters, setFilters] = useState<CompetitionFilterValues>(init.filters);
  const [density, setDensity] = useState<Density>(init.density);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<CompetitionFilterValues>(filters);
  const [draftStatus, setDraftStatus] = useState<Status>(status);
  // fish: where the user was before a search took over, so back returns there.
  // State, not refs: the handlers that read it are built during render (React Compiler rule).
  const [before, setBefore] = useState<{ scope: CompetitionCardsScope; status: CompetitionCardStatus }>({
    scope: 'all',
    status: 'notStarted',
  });
  const [now] = useState(() => new Date());

  const mineActive = scope === 'registered';
  const resultsMode = isResultsMode({ search, filters });

  // Mirror the place into the URL (defaults drop out, `?state=` stays).
  useListUrlState({
    status: status === 'notStarted' ? null : status,
    scope: scope === 'all' ? null : scope,
    q: search?.value,
    period: filters.period === 'all' ? null : filters.period,
    format: filters.format === 'all' ? null : filters.format,
    available: filters.availableOnly ? '1' : null,
    view: density === 'poster' ? null : density,
  });

  // Focus to restore after a commit that unmounts the focused control (the results back square,
  // the empty card's button): an element id, applied once the new frame is on screen.
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    document.getElementById(id)?.focus();
  });

  const params = listParamsFor({ scope, status, search, filters, density });
  const pollLive = status === 'started' && !mineActive;
  const list = useInfiniteQuery(
    demoKey(competitionCardsInfiniteQuery(t, params, session, { refetchInterval: pollLive ? LIVE_POLL_MS : false }), state),
  );
  const sel = selectCompetitionCards(list.data, params, session);

  // «Ale mele» tab: shown for any registration, badge counts what is still ahead (fish).
  const registeredParams = REGISTERED_PARAMS;
  const registered = useInfiniteQuery(demoKey(competitionCardsInfiniteQuery(t, registeredParams, session), state));
  const regSel = selectCompetitionCards(registered.data, registeredParams, session);
  const regCounts = regSel.counts;
  const registeredAhead = regCounts ? regCounts.notStarted + regCounts.started : 0;
  const registeredTotal = regCounts ? regCounts.notStarted + regCounts.started + regCounts.completed : 0;

  // The bento (and the aside) read the same cached Live / Viitoare lists the tabs use.
  const showPulse = showsPulse({ status, scope, search, filters, density });
  const liveQ = useInfiniteQuery(demoKey(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, session), state));
  const upcomingQ = useInfiniteQuery(demoKey(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, session), state));
  const liveSel = selectCompetitionCards(liveQ.data, PULSE_CARD_PARAMS.live, session);
  const liveCards = liveSel.competitions;
  const upcomingCards = selectCompetitionCards(upcomingQ.data, PULSE_CARD_PARAMS.upcoming, session).competitions;
  const featuredEnabled = showPulse && liveQ.isSuccess && liveCards.length === 0;
  const featured = useQuery(demoKey(featuredCompetitionQuery(t, featuredEnabled), state));
  const person = useQuery(demoKey(pulsePersonQuery(t, showPulse), state));
  const tile = pulseCountTile({ live: liveCards, upcoming: upcomingCards }, now.getTime());
  const heroCard = liveCards[0] ?? featured.data ?? upcomingCards[0] ?? null;
  // The hero is picked ONCE: until every rung that could win has answered, the skeleton holds the
  // space (the upcoming list arrives hydrated, Live does not — painting from it first swapped the
  // hero and grew the bento under the user).
  const heroPending =
    liveQ.isPending ||
    (featuredEnabled && featured.isPending) ||
    (!liveCards[0] && !featured.data && upcomingQ.isPending);

  // The sheet's «Arată N concursuri» previews the draft (fish `preview`).
  const previewParams = { ...params, status: draftStatus === 'all' || mineActive ? undefined : draftStatus, filters: draft };
  const preview = useInfiniteQuery({ ...demoKey(competitionCardsInfiniteQuery(t, previewParams, session), state), enabled: filtersOpen });
  const previewTotal = selectCompetitionCards(preview.data, previewParams, session).total;
  // A count only from a read that answered: failed, paused (offline) or not yet run, «0» would be a lie.
  const previewKnown = preview.isSuccess;

  /* ---------------- actions ---------------- */

  const changeStatus = (next: Status) => {
    setStatus(next);
    // Picking a status tab is how you leave «Ale mele» (fish).
    setScope((s) => (s === 'registered' ? 'all' : s));
  };
  const toggleScope = (target: 'registered' | 'followed') => setScope((s) => (s === target ? 'all' : target));

  const commitSearch = (value: string) => {
    if (!resultsMode) setBefore({ scope, status: status === 'all' ? before.status : status });
    setSearch({ type: 'text', value, label: value });
    setScope('all');
    setStatus('all');
  };

  /** `focusTitle`: the control that called it unmounts with results mode — land on the h1. */
  const exitResults = (focusTitle = false) => {
    if (focusTitle) focusAfter.current = 'concursuri-titlu';
    setSearch(null);
    setFilters(DEFAULT_COMPETITION_FILTERS);
    setScope(before.scope);
    setStatus(before.status);
  };

  /** Desktop column and chips apply at once. Emptying the last filter leaves results mode. */
  const applyFilters = (next: CompetitionFilterValues, nextStatus: Status = status) => {
    if (!resultsMode && hasActiveFilters(next)) {
      setBefore({ scope: scope === 'followed' ? scope : 'all', status: status === 'all' ? before.status : status });
    }
    setFilters(next);
    if (search === null && !hasActiveFilters(next)) {
      setScope(before.scope);
      setStatus(before.status);
    } else {
      setStatus(nextStatus);
    }
  };

  const openFilters = () => {
    setDraft(filters);
    setDraftStatus(status);
    setFiltersOpen(true);
  };

  // A retry after an outage goes back to the network for EVERY region on the page — the list, the
  // tabs' counts, «Ale mele», the bento (featured, the person) and the sheet's preview — not a
  // hand-picked few, so nothing that failed in the same outage stays silently missing (a demo outage
  // heals here).
  const retriedRef = useRef(false);
  const retry = () => {
    retriedRef.current = true;
    t.heal();
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

  // Forced next-page states: ask for page 2 once page 1 is on screen (the real path, not a prop).
  const kicked = useRef(false);
  const kickNextPage = (state === 'next-page' || state === 'next-page-error') && list.isSuccess && list.hasNextPage;
  useEffect(() => {
    if (!kickNextPage || kicked.current) return;
    kicked.current = true;
    void list.fetchNextPage();
  }, [kickNextPage, list]);

  /* ---------------- derived copy ---------------- */

  const total = sel.total;
  const heading = headingFor({ status, scope, search, filters });

  const countText = mineActive || status === 'all' ? mixedCountLabel(total) : countLabel(total, status);

  const chips: ActiveFilter[] = [];
  if (resultsMode && status !== 'all') {
    chips.push({
      key: 'status',
      label: STATUS_CHIP[status],
      leading: status === 'started' ? <LiveDot /> : undefined,
      onClear: () => applyFilters(filters, 'all'),
    });
  }
  if (filters.availableOnly)
    chips.push({ key: 'available', label: 'Locuri libere', onClear: () => applyFilters({ ...filters, availableOnly: false }) });
  if (filters.period !== 'all')
    chips.push({
      key: 'period',
      label: periodChipLabel(filters.period, now),
      onClear: () => applyFilters({ ...filters, period: 'all' }),
    });
  if (filters.format !== 'all')
    chips.push({ key: 'format', label: FORMAT_LABEL[filters.format], onClear: () => applyFilters({ ...filters, format: 'all' }) });

  /** What narrows the list — the button's badge, the chips and «Arată N» agree (status included). */
  const filterCount = chips.length;
  const draftCount = countActiveFilters(draft) + (resultsMode && draftStatus !== 'all' ? 1 : 0);

  /* ---------------- regions ---------------- */

  const regionId = 'concursuri-lista';
  const titleId = 'concursuri-titlu';
  const summaryId = 'concursuri-lista-titlu';

  const tabs: ListTab<CompetitionCardStatus | 'mine'>[] = [
    { key: 'notStarted', label: TAB_LABEL.notStarted },
    {
      key: 'started',
      label: TAB_LABEL.started,
      // The live list's own total, whatever list is on screen («Ale mele» counts only its own).
      leading: liveSel.total > 0 ? <LiveDot /> : undefined,
    },
    { key: 'completed', label: TAB_LABEL.completed },
    ...(registeredTotal > 0
      ? [
          {
            key: 'mine' as const,
            label: 'Ale mele',
            count: registeredAhead,
            accessibleLabel: registeredAhead > 0 ? `Ale mele, ${registeredAhead}` : 'Ale mele',
          },
        ]
      : []),
  ];

  // «Ale mele» is a tab only once there is something in it. Asked for anyway (?scope=registered) and
  // settled at zero, the place does not exist: back to the public list (a signed-out visitor keeps
  // the sign-in gate instead — see the body).
  if (mineActive && isAuthenticated && registered.isSuccess && registeredTotal === 0) setScope('all');
  const activeTab = mineActive ? ('mine' as const) : status === 'all' ? undefined : status;
  // The list region is the tabs' panel only while the current tab is on screen (no dangling aria-labelledby).
  const activeTabShown = !resultsMode && activeTab !== undefined && tabs.some((tab) => tab.key === activeTab);

  // Results mode, 1280+: the band the tab row leaves always carries the ANSWER (aria-hidden there:
  // the list's heading, its live regions and the state card say it) — the count, «Se caută…» while
  // it loads, «Niciun rezultat» / «Căutarea nu a reușit» — never an empty 44px strip. The density
  // toggle sits at its right end, so it never takes a row of its own over the list.
  const answering = list.isLoading || state === 'busy' || (list.isPlaceholderData && list.isFetching);
  const bandText = answering
    ? 'Se caută…'
    : list.isError && sel.competitions.length === 0
      ? 'Căutarea nu a reușit'
      : total === 0
        ? 'Niciun rezultat'
        : countText;
  const listShown = !list.isLoading && !sel.requiresSignIn && sel.competitions.length > 0;
  const viewToggle = listShown ? (
    <ViewToggle
      label="Afișare"
      value={density}
      onChange={setDensity}
      options={[
        { value: 'list', label: 'Listă', icon: <ListBulletIcon /> },
        { value: 'poster', label: 'Afiș', icon: <Squares2X2Icon /> },
      ]}
    />
  ) : undefined;

  const followedOn = scope === 'followed';
  const header = (
    <ListHeader
      titleId={titleId}
      title={resultsMode ? heading : 'Competiții'}
      back={resultsMode ? { label: 'Înapoi la concursuri', onClick: () => exitResults(true) } : undefined}
      // From 1280 the tab row's band stays in results mode (a pick in the live-apply column must not
      // pull the column up under the pointer) and carries the answer's size instead of a blank row.
      reserveBelow={resultsMode ? bandText : false}
      reserveEnd={resultsMode ? viewToggle : undefined}
      actions={
        <>
          {!resultsMode ? (
            // The page-ground tool look (surface + hairline, tint when on), like the toolbar beside it.
            <ListHeaderToggle label="Urmărite" icon={<EyeIcon aria-hidden />} pressed={followedOn} onToggle={() => toggleScope('followed')} />
          ) : null}
          {state === 'actions' ? (
            // From 768 the action sits in the header; below, StickyActions carries it.
            <span className="hidden md:contents">
              <ButtonLink href={DEMO_PATH} icon={<PlusIcon />}>
                Creează concurs
              </ButtonLink>
            </span>
          ) : null}
        </>
      }
      below={
        resultsMode ? undefined : (
          <ListTabs
            label="Stare concursuri"
            tabs={tabs}
            active={activeTab}
            controls={regionId}
            onSelect={(k) => (k === 'mine' ? toggleScope('registered') : changeStatus(k))}
          />
        )
      }
    />
  );

  /** The filter questions, once for the column (list rows) and once for the Sheet / Dialog (pills). */
  const sections = (values: CompetitionFilterValues, st: Status, onValues: (v: CompetitionFilterValues) => void, onStatus: (s: Status) => void, inSheet: boolean) => {
    const layout = inSheet ? 'chips' : 'list';
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
    const periods = periodOptions(now, st);
    const periodList: Choice<string>[] = periods.some((p) => p.value === values.period)
      ? periods
      : [...periods, { value: values.period, label: periodChipLabel(values.period, now) }];
    // «Weekendul acesta · 10–11 oct.»: the dates are what sets the choice apart — a line of their
    // own in the narrow column (never truncated away), joined back with «·» on the pills.
    const periodChoices = periodList.map((p) => {
      const [label, detail] = p.label.split(' · ');
      return detail ? { ...p, label, detail } : p;
    });
    // Geometry stays put under the pointer (≥1280 applies live): «Locuri libere» is always there
    // (disabled with the reason off Viitoare), and «Stare» — only in results mode — comes LAST, so
    // entering results mode adds under the choice just picked, never above it.
    const availableApplies = st === 'notStarted';
    return (
      <>
        <FilterSwitch
          label="Locuri libere"
          description={availableApplies ? 'Doar concursurile care mai au locuri' : 'Doar pentru concursurile viitoare'}
          checked={values.availableOnly}
          disabled={!availableApplies}
          onChange={(availableOnly) => onValues({ ...values, availableOnly })}
        />
        <FilterSection title="Perioadă">
          <ChoiceChips
            name="perioada"
            layout={layout}
            options={periodChoices}
            value={values.period}
            scroll={inSheet}
            onChange={(period) => onValues({ ...values, period })}
          />
        </FilterSection>
        <FilterSection title="Format">
          <ChoiceChips name="format" layout={layout} options={formatChoices} value={values.format} onChange={(format) => onValues({ ...values, format })} />
        </FilterSection>
        {resultsMode ? (
          <FilterSection title="Stare">
            <ChoiceChips name="stare" layout={layout} options={statusChoices} value={st} onChange={onStatus} />
          </FilterSection>
        ) : null}
      </>
    );
  };

  const filtersColumn = (
    <FilterColumn onReset={() => applyFilters(DEFAULT_COMPETITION_FILTERS, resultsMode ? 'all' : status)} canReset={filterCount > 0}>
      {sections(filters, status, (v) => applyFilters(v), (s) => applyFilters(filters, s), false)}
    </FilterColumn>
  );

  const surface = (
    <FiltersSurface
      open={filtersOpen}
      // Browse mode fits in half the phone (switch, period row, format); results mode adds «Stare».
      initialSnap={resultsMode ? 0.9 : 0.5}
      onClose={() => setFiltersOpen(false)}
      onReset={() => {
        setDraft(DEFAULT_COMPETITION_FILTERS);
        if (resultsMode) setDraftStatus('all');
      }}
      canReset={draftCount > 0}
      apply={{
        label: previewKnown ? `Arată ${nounCount(previewTotal, 'concurs', 'concursuri')}` : 'Arată concursurile',
        onApply: () => {
          applyFilters(draft, draftStatus);
          setFiltersOpen(false);
        },
      }}
    >
      {sections(draft, draftStatus, setDraft, setDraftStatus, true)}
    </FiltersSurface>
  );

  /* ---------------- body ---------------- */

  const competitions: CompetitionCard[] = sel.competitions;
  const loading = list.isLoading;
  const failed = list.isError && competitions.length === 0;
  // The first page failed or came back empty: the slots held for the bento and the aside are given
  // up in this same frame (see below), so nothing collapses later under the state card.
  const listGaveUp = failed || (list.isSuccess && total === 0);
  // A tab / filter switch over the previous list (keepPrevious): the old rows dim, the count waits.
  const busy = state === 'busy' || (list.isPlaceholderData && list.isFetching);
  const countBusy = loading || busy;

  // After a manual retry succeeds, focus lands on the list's heading (the error card it was on is gone).
  const summaryShown = !(resultsMode && (failed || (!countBusy && total === 0)));
  useEffect(() => {
    if (!retriedRef.current || failed || loading) return;
    retriedRef.current = false;
    document.getElementById(summaryShown ? summaryId : titleId)?.focus();
  }, [failed, loading, summaryShown]);

  // One look for the rows' last column, decided by the list (see RowEnd).
  const rowEnd: RowEnd = rowEndFor({ status, scope });

  const emptyTitle = resultsMode
    ? search
      ? status === 'all'
        ? `Niciun concurs pentru „${search.label}”`
        : `Niciun concurs ${STATUS_WORD[status].one} pentru „${search.label}”`
      : 'Niciun concurs cu aceste filtre'
    : scope === 'followed'
      ? 'Niciun concurs urmărit aici'
      : 'Niciun concurs găsit';
  // The empty answer is SPOKEN: this region is always mounted (outside the list region, which is
  // re-keyed), so it is there before the text lands; it is the only place the empty title is
  // announced (ListSummary's own region carries counts, and is unmounted in results mode when empty).
  const settledEmpty = !sel.requiresSignIn && list.isSuccess && !busy && total === 0 && competitions.length === 0;
  const emptyAnnouncement = settledEmpty ? emptyTitle : '';

  let body: ReactNode;
  if (sel.requiresSignIn) {
    body = (
      <ListSignInGate
        title={scope === 'followed' ? 'Concursurile urmărite' : 'Înscrierile tale'}
        description="Intră în cont ca să vezi concursurile tale."
        // Back to the scope itself, never to a `?state=` that forces the signed-out view again.
        href={`/intra?next=${encodeURIComponent(`${DEMO_PATH}?scope=${scope === 'followed' ? 'followed' : 'registered'}`)}`}
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
            <Button
              variant="outline"
              aria-disabled={signingOut || undefined}
              aria-busy={signingOut || undefined}
              onClick={signOut}
            >
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (loading) {
    body =
      density === 'list' ? (
        <ListSkeleton variant="rows" count={6} label="Se încarcă concursurile…" head={<CompetitionRowsHead end={rowEnd} />} />
      ) : (
        <ListSkeleton variant="cards" min="sm" count={6} label="Se încarcă concursurile…" />
      );
  } else if (competitions.length === 0) {
    const title = emptyTitle;
    const description = resultsMode
      ? search
        ? 'Încearcă alt tab de stare sau caută altceva.'
        : 'Încearcă alt tab de stare sau elimină câteva filtre.'
      : scope === 'followed'
        ? 'Salvează concursurile care te interesează sau verifică celelalte taburi.'
        : 'Schimbă tabul pentru a vedea alte concursuri.';
    body = (
      <ListEmpty
        title={title}
        description={description}
        action={
          resultsMode ? (
            <Button variant="secondary" onClick={() => exitResults(true)}>
              {search ? 'Înapoi la concursuri' : 'Șterge filtrele'}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (density === 'list') {
    body = (
      <ListRows labelledBy={summaryId} head={<CompetitionRowsHead end={rowEnd} />}>
        {competitions.map((c, i) => (
          // No bento above: the first rows carry the page's LCP image.
          <CompetitionRow key={c.documentId} competition={c} end={rowEnd} priority={!showPulse && i < 3} />
        ))}
      </ListRows>
    );
  } else {
    body = (
      <ListGrid labelledBy={summaryId} min="sm">
        {competitions.map((c) => (
          <li key={c.documentId} className="flex flex-col [&>article]:flex-1">
            <CompetitionPoster competition={c} />
          </li>
        ))}
      </ListGrid>
    );
  }

  const showData = !loading && !failed && !sel.requiresSignIn && competitions.length > 0;

  /* ---------------- aside ---------------- */

  const myCards = regSel.competitions.filter((c) => c.status !== 'completed').slice(0, 3);
  const asideIsLive = status !== 'started';
  // With the bento up, its hero IS the first live competition — the aside lists the OTHERS, and says
  // so («Alte concursuri live»): the hero's LIVE pill and the count tile are right beside it, so a
  // second «Live acum» heading would only repeat them.
  const heroId = showPulse && heroCard ? heroCard.documentId : null;
  const heroIsLive = showPulse && heroCard?.status === 'started';
  const asideList = (asideIsLive ? liveCards : upcomingCards).filter((c) => c.documentId !== heroId).slice(0, 4);
  const mineBlock =
    isAuthenticated && !mineActive && myCards.length > 0 ? (
      <AsideSection key="mine" title="Înscrierile mele" action={<TextAction onClick={() => toggleScope('registered')}>Vezi toate</TextAction>}>
        <AsideList items={myCards} />
      </AsideSection>
    ) : null;
  const nextBlock =
    asideList.length > 0 ? (
      <AsideSection
        key="next"
        title={asideIsLive ? (heroIsLive ? 'Alte concursuri live' : 'Live acum') : 'Încep curând'}
        action={<TextAction onClick={() => changeStatus(asideIsLive ? 'started' : 'notStarted')}>Vezi toate</TextAction>}
      >
        {/* The section already says LIVE: no pill per row (it cost the names their room). */}
        <AsideList items={asideList} showLive={!asideIsLive} />
      </AsideSection>
    ) : null;
  // «Înscrierile mele» is never held by a speculative skeleton: most people have no registration
  // ahead, and a held block that settles empty drops everything under it. Whether it is KNOWN at the
  // first paint is decided once, at mount — the server hydrates it (page.tsx) — and that decides its
  // place: known → its normal place (first in the column; below 1280 under the bento); learnt later
  // → only where a late insert moves nothing (the END of the docked column; not inline at all).
  const [mineLate] = useState(() => registered.isPending);
  // «Live acum» / «Încep curând» is held by its skeleton until ITS OWN source answers — whatever the
  // list does — so a block is never dropped and then inserted again.
  const PENDING = 'pending' as const;
  const nextSlot = asideIsLive ? (liveQ.isPending ? PENDING : nextBlock) : upcomingQ.isPending ? PENDING : nextBlock;
  const slots = (held: Array<ReactNode | typeof PENDING>): ReactNode[] =>
    held.flatMap((slot, i): ReactNode[] => (slot === PENDING ? [<AsideSkeleton key={`held-${i}`} />] : slot ? [slot] : []));
  const docked = slots(mineLate ? [nextSlot, mineBlock] : [mineBlock, nextSlot]);
  // Docked, an empty column is also held while the centre's first page loads: dropping it would
  // reflow the centre's skeleton grid wider.
  const holdAside = nextSlot === PENDING || (docked.length === 0 && list.isLoading && !listGaveUp);
  const aside = docked.length > 0 ? <>{docked}</> : holdAside ? <AsideSkeleton /> : undefined;
  const asideLabel = 'Ce se întâmplă acum';
  // Below the dock (1440) the answer comes first. Only the default browse view (Viitoare under the bento) gets
  // an inline block before the list — «Înscrierile mele», when it is known at the first paint (the
  // count tile above is already the way to Live). On Live, Rezultate, «Urmărite» and in results mode
  // the list the user asked for is not pushed below a secondary block: those blocks stay in the
  // docked column (1440+).
  const inline = showPulse && !mineLate && mineBlock ? [mineBlock] : [];

  // The bento slot holds its skeleton until the hero is decided AND the first page has settled, so
  // when it resolves to nothing the list's skeleton is replaced in the same frame instead of sliding
  // up under the user. And once the first page has FAILED or come back EMPTY (an outage, an empty
  // CMS) the slot is given up at once, in that same frame — never collapsed later, under the
  // state card, when the bento's own reads settle.
  const pulse = showPulse && !listGaveUp ? (
    heroPending || (!heroCard && list.isLoading) ? (
      <PulseHeroSkeleton />
    ) : heroCard ? (
      <PulseHero
        data={{
          hero: heroCard,
          featured: !liveCards[0] && Boolean(featured.data) && heroCard === featured.data,
          liveCount: liveSel.total,
          startingSoonCount: tile.startingSoonCount,
          faces: tile.faces,
          // A failed person read is held while it is asked again (the page's retry refetches it), and
          // dropped only once it has settled failed — an outage is not «nobody».
          person: person.isSuccess ? (person.data ?? null) : person.isError && !person.isFetching ? null : undefined,
        }}
        onOpenLive={() => changeStatus(liveCards.length ? 'started' : 'notStarted')}
      />
    ) : null
  ) : null;

  const summary = summaryShown ? (
    <ListSummary
      id={summaryId}
      variant={resultsMode ? 'quiet' : 'title'}
      // Results mode, 1280+: the header band shows the answer and the toggle; the row takes no space
      // (the grid starts right under the search), the heading stays the region's name.
      titleHiddenFrom={resultsMode ? 'xl' : undefined}
      busy={busy}
      title={resultsMode ? (countBusy ? 'Se caută…' : countText) : heading}
      count={resultsMode || sel.requiresSignIn || failed || countBusy || total === 0 ? undefined : countText}
      loading={!resultsMode && countBusy && !sel.requiresSignIn && !failed}
      end={showData ? viewToggle : undefined}
    />
  ) : null;

  return (
    <ListPage
      header={header}
      filters={filtersColumn}
      filtersLabel="Filtre concursuri"
      aside={aside}
      asideLabel={asideLabel}
      // The centre gets the width until 1440: at 1280 the three columns left it ~640, two posters
      // wide, so a page of results ended on a lone card beside an empty half (and a two-column page
      // ran ~2200px under side columns that end at ~770). From 1280 it holds three posters (and the
      // «Listă» table); the aside docks from 1440 — the bento already carries Live up to there.
      asideFrom="2xl"
      asideInline={false}
      asideBusy={holdAside}
      actions={
        state === 'actions' ? (
          <StickyActions>
            <ButtonLink href={DEMO_PATH} icon={<PlusIcon />} block>
              Creează concurs
            </ButtonLink>
          </StickyActions>
        ) : undefined
      }
    >
      {state === 'crash' ? <Crash /> : null}
      <ListToolbar>
        <ListSearch
          label="Caută un concurs, o baltă sau un organizator"
          placeholder="Concurs, baltă sau organizator"
          committed={search?.label}
          onCommit={commitSearch}
          onClear={() => exitResults()}
        />
        <FilterButton count={filterCount} onClick={openFilters} expanded={filtersOpen} />
      </ListToolbar>
      {/* What narrows the list sits right under the «Filtre» button that produced it. */}
      <ActiveFilters
        // 1280+: the docked column shows every choice, checked; the chips would only repeat it.
        className="xl:hidden"
        filters={chips}
        fallbackFocusIds={[summaryId, titleId]}
        onClearAll={() => {
          setFilters(DEFAULT_COMPETITION_FILTERS);
          if (search === null) {
            setScope(before.scope);
            setStatus(before.status);
          } else setStatus('all');
        }}
      />

      {pulse}
      <p aria-live="polite" className="sr-only">
        {emptyAnnouncement}
      </p>
      {inline.length > 0 ? (
        <aside aria-label={asideLabel} className={`${ASIDE_INLINE} 2xl:hidden`}>
          {inline}
        </aside>
      ) : null}

      <ListRegion
        // When the first page gives up under the bento's skeleton, the slot above goes and the list
        // takes its place: a NEW region (the state card), not the old one sliding 300px up — a
        // moved region is a layout shift, a replaced one is not. Only on Viitoare-with-bento, where
        // nothing in the region holds focus or speaks at that moment (the summary has no count; the
        // error card announces itself as an alert).
        key={showPulse && listGaveUp ? 'gave-up' : 'list'}
        id={regionId}
        tabpanel={activeTabShown}
        labelledBy={activeTabShown ? `${regionId}-tab-${activeTab}` : summaryShown ? summaryId : titleId}
        busy={busy}
      >
        {summary}
        {body}
        {showData ? (
          <ListFooter
            hasMore={Boolean(list.hasNextPage)}
            loadingMore={list.isFetchingNextPage}
            error={list.isFetchNextPageError}
            errorLabel="Nu am putut încărca mai multe concursuri."
            onLoadMore={() => {
              if (!list.hasNextPage || list.isFetchingNextPage) return;
              if (list.isFetchNextPageError) t.heal();
              void list.fetchNextPage();
            }}
            shown={competitions.length}
            total={total}
            noun="concursuri"
            endLabel={competitions.length > 6 ? 'Ai văzut toate concursurile.' : undefined}
          />
        ) : null}
      </ListRegion>
      {surface}
    </ListPage>
  );
}

/** A compact competition list for the aside. `showLive` marks LIVE rows (off when the section is the live list). */
function AsideList({ items, showLive = true }: { items: CompetitionCard[]; showLive?: boolean }) {
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((c) => {
        const look = statusLook(c);
        return (
          <li key={c.documentId}>
            <Link href={routes.competition(c.documentId)} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-soft-fill">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
                <Image src={competitionImage(c)} alt="" fill sizes="40px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 t-body-strong text-ink">{c.name}</span>
                <span className="block truncate t-caption text-muted">
                  {c.dateLabel}
                  {c.lake ? ` · ${c.lake.name}` : ''}
                </span>
              </span>
              {showLive && look.tone === 'live' ? <StatusPill tone="live">LIVE</StatusPill> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
