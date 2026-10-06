'use client';

import { MapIcon } from '@heroicons/react/24/outline';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/surfaces/Dialog';
import { SidePanel } from '@/components/surfaces/SidePanel';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ListEmpty, ListError } from '@/components/templates/T1';
import { T2_FLOATING_BUTTON } from '@/components/templates/T2';
import { plural } from '@/components/cards/format';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildLakesHomeSections,
  DEFAULT_NEARBY_RADIUS_KM,
  deriveNearbyPermissionPlaceholderMode,
  EMPTY_LAKE_FILTERS,
  DEFAULT_LAKES_COMMITTED_SEARCH,
  getLakesByDocumentIds,
  getTotalLakesInSections,
  lakesHomeQuery,
  splitLakesHomeSections,
  type LakeFilterSection,
  type LakeFilterValues,
  type LakeHomeSection,
  type LakesCommittedSearch,
} from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import {
  clearDraftSection,
  draftHasSelection,
  filterPanelTitle,
  FiltersBody,
  FiltersFooter,
  useDraftCount,
  useFilterCatalogs,
} from './FiltersPanel';
import { readErrorDescription, useFocusAfterRetry } from './errors';
import { HomeHeader } from './HomeHeader';
import { HOME_LIMIT, HOME_PARAMS } from './homeParams';
import { HomeRow, HomeSkeleton, NearbyPlaceholder, NearbySlotSkeleton, SlotRowSkeleton } from './HomeRow';
import { markAutoDialogShown, requestUserPosition, useLakesLocation, useLocationDialog, watchAutoDialog } from './location';
import { LocationDialog } from './LocationDialog';
import { PhoneSheet } from './PhoneSheet';
import { SearchLayer } from './SearchLayer';
import { useRecentViewedLakeIds } from './storage';
import { countLakeFilters, lakesMapQuery } from './url';

/*
 * lakes.home — fish app/(app)/(tabs)/lakes/index.tsx in its home mode: the Bălți / Ape publice
 * switch, the search bubble and «Filtre», then the rows (recently viewed, nearby or its location
 * placeholder, all lakes, the CMS's fixed rows) and, on a phone, the floating «Vezi bălțile pe
 * hartă». fish's results mode is its own page on the web (/balti/harta, LakesMap): every way into
 * it here navigates there with the search and filters in the URL (./url.ts).
 *
 * First paint = the server's: the hydrated /lakes/home rows render on the server and on the first
 * client pass (recents read «none yet» there, ./storage.ts). What arrives later takes a slot that
 * is already reserved — «Vizualizate recent» on top, the nearby slot (the placeholder card's box
 * while the permission is read, a row as soon as the permission reads «granted»: ./location.ts
 * says so before the position comes back) — so the rows do not jump.
 *
 * Screen readers: one status line (below) says what is loading and when the rows are in; the
 * skeletons are silent. A retry that works puts focus on the first row's heading.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function LakesHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useMemo(() => createBrowserTransport(), []);
  const location = useLakesLocation();
  const bp = useBreakpoint();
  const nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;

  // Recently viewed (per browser), re-read when the tab comes back (fish useFocusEffect, c22).
  const ids = useRecentViewedLakeIds();

  const position = location.state === 'granted' ? location.position : null;
  const home = useQuery(
    lakesHomeQuery(t, {
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      radiusKm: nearbyRadiusKm,
      limit: HOME_LIMIT,
    }),
  );
  const recent = useQuery({
    // fish builds this key inline (lakes/index.tsx), cached a day.
    queryKey: ['lakes', 'home', 'recent-viewed', ids.join(',')],
    queryFn: () => getLakesByDocumentIds(t, ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  // A failed located read keeps the rows the user was reading: the no-location entry stays in the
  // cache (TanStack drops the placeholder on error). Only the nearby slot reports the failure.
  const nearbyFailed = position != null && home.isError;
  const homeData = home.data ?? (nearbyFailed ? queryClient.getQueryData(lakesHomeQuery(t, HOME_PARAMS).queryKey) : undefined);
  const nearbyPending = location.state === 'granted' && !home.isError && (!position || home.isPlaceholderData);

  const sections = useMemo(() => {
    const { nearbySection, allLakesSection, fixedSections } = splitLakesHomeSections(homeData ?? []);
    return buildLakesHomeSections({
      recentViewedLakes: ids.length ? (recent.data ?? []) : [],
      nearbySection: location.state === 'granted' && !home.isPlaceholderData ? nearbySection : null,
      allLakesSection,
      // Until the permission is read the slot is reserved (NearbySlotSkeleton), never «Permite
      // locația» flashing for a user who already allowed it.
      nearbyPermissionPlaceholderMode: location.known ? deriveNearbyPermissionPlaceholderMode(location.state) : null,
      fixedSections,
    });
  }, [homeData, home.isPlaceholderData, recent.data, ids.length, location.state, location.known]);
  const totalLakes = getTotalLakesInSections(sections);

  /* -------------------------------------------------------------- location */
  const [searchOpen, setSearchOpen] = useState(false);
  // The location dialog, and the search's «În jurul meu» hand-off into it (shared with the map):
  // the search closes first, and a retry that gets a position finishes that pick (the nearby map).
  const locationDialog = useLocationDialog({ closeSearch: () => setSearchOpen(false), commit: (search) => openMap(search) });
  const openDialog = locationDialog.open;
  // fish: the services-off dialog opens by itself once per session, again only after the state
  // left services_off (c20; the flag lives in ./location.ts, not in this mount).
  useEffect(() => watchAutoDialog('services_off', () => openDialog('services_off')), [openDialog]);

  /** fish handleNearbyPlaceholderPress (c18). */
  const activateNearby = useCallback(async () => {
    if (location.state === 'services_off') return openDialog('services_off');
    if (location.state === 'denied') return openDialog('permission');
    // never_asked → the browser asks; granted without a position yet → read it.
    markAutoDialogShown('services_off'); // the outcome below is answered here, not by the auto-open
    const result = await requestUserPosition();
    if (result.state === 'services_off') openDialog('services_off');
  }, [location.state, openDialog]);

  /* -------------------------------------------------------------- search + filters */
  const searchPillRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<LakeFilterSection | null>(null);
  const [draft, setDraft] = useState<LakeFilterValues>(EMPTY_LAKE_FILTERS);
  const catalogs = useFilterCatalogs(t, panel !== null);
  const count = useDraftCount(t, DEFAULT_LAKES_COMMITTED_SEARCH, draft, panel !== null);

  const openMap = (search: LakesCommittedSearch, filters: LakeFilterValues = EMPTY_LAKE_FILTERS) =>
    router.push(routes.lakesMap(lakesMapQuery({ search, filters })));

  const nearbyHref = routes.lakesMap(
    lakesMapQuery({ search: { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'nearby', radiusKm: nearbyRadiusKm } }),
  );
  /** fish handlePressSeeAllInSection (c11). */
  const seeAllHref = (section: LakeHomeSection) => {
    if (section.key === 'bookable') return routes.lakesMap(lakesMapQuery({ filters: { ...EMPTY_LAKE_FILTERS, bookableOnly: true } }));
    if (section.key === 'nearby' && position) return nearbyHref;
    return routes.lakesMap();
  };

  /* -------------------------------------------------------------- body */
  const recentPending = ids.length > 0 && recent.isPending;
  const recentFailed = ids.length > 0 && recent.isError && !recent.data;
  const loading = !homeData && home.isPending;
  const rowsRef = useRef<HTMLDivElement>(null);
  const armRetryFocus = useFocusAfterRetry(Boolean(homeData) && !loading, () => rowsRef.current?.querySelector<HTMLElement>('h2') ?? null);
  const retryHome = () => {
    armRetryFocus();
    void home.refetch();
  };
  let body: ReactNode;
  if (loading) {
    body = <HomeSkeleton nearbySlot={location.state === 'granted' ? 'row' : 'placeholder'} />;
  } else if (home.isError && !homeData && totalLakes === 0 && !recentPending) {
    // fish ErrorScreen (c25): the page's one message and a retry. fish checks «no sections», and its
    // never-asked location placeholder counts as one — a failed read then shows that card alone,
    // with no word of the failure (fish bug). The web counts lake rows: no lakes → the error.
    body = (
      <div className="grid min-h-80 place-items-center">
        <ListError
          title="Nu am putut încărca bălțile"
          description={readErrorDescription(home.error)}
          onRetry={retryHome}
          retrying={home.isFetching}
          retryLabel="Încearcă din nou"
          attempt={Math.max(1, home.errorUpdateCount)}
        />
      </div>
    );
  } else {
    // The nearby slot when no section fills it: reserved while the permission is read or the
    // located read runs, an inline error when that read failed (the rows stay).
    const nearbySlot: ReactNode = sections.some((s) => s.key === 'nearby') ? null : !location.known ? (
      <NearbySlotSkeleton key="nearby-slot" />
    ) : nearbyFailed ? (
      <InlineError
        key="nearby-slot"
        title="Nu am putut încărca bălțile din zona ta"
        error={home.error}
        attempt={home.errorUpdateCount}
        onRetry={() => void home.refetch()}
        retrying={home.isFetching}
      />
    ) : nearbyPending ? (
      <SlotRowSkeleton key="nearby-slot" />
    ) : null;
    // /lakes/home failed with no rows to keep, but the recently viewed lakes are there: they stay,
    // and the failure is said under them with its retry.
    const homeError =
      home.isError && !homeData ? (
        <InlineError
          key="home-error"
          title="Nu am putut încărca bălțile"
          error={home.error}
          attempt={home.errorUpdateCount}
          onRetry={retryHome}
          retrying={home.isFetching}
        />
      ) : null;

    const blocks: ReactNode[] = [];
    if (recentPending) blocks.push(<SlotRowSkeleton key="recent-slot" compact />);
    // A failed /lakes/by-ids read is said in its own slot, with its retry (the rows below stay).
    else if (recentFailed)
      blocks.push(
        <InlineError
          key="recent-slot"
          title="Nu am putut încărca bălțile vizualizate recent"
          error={recent.error}
          attempt={recent.errorUpdateCount}
          onRetry={() => void recent.refetch()}
          retrying={recent.isFetching}
        />,
      );
    let nearbyPlaced = false;
    const placeNearby = () => {
      if (nearbyPlaced) return;
      nearbyPlaced = true;
      if (nearbySlot) blocks.push(nearbySlot);
      if (homeError) blocks.push(homeError);
    };
    sections.forEach((section, i) => {
      if (section.key !== 'recent_viewed') placeNearby();
      blocks.push(renderSection(section, i + 1));
    });
    placeNearby();
    body = (
      // `@container`: the rails size their tracks from this column (HorizontalRail RAIL_GRID, 100cqw).
      <div ref={rowsRef} className="@container flex flex-col gap-7 xl:gap-9">
        {blocks}
        {!sections.length && !homeError && !recentPending && !recentFailed && !nearbySlot ? (
          <ListEmpty title="Momentan nu este disponibilă nicio baltă." />
        ) : null}
      </div>
    );
  }

  // The one status line (the skeletons are silent): what is loading, then what arrived. Errors
  // speak through their own alerts.
  const busyLine = loading
    ? 'Se încarcă bălțile'
    : recentPending
      ? 'Se încarcă bălțile vizualizate recent'
      : nearbyPending
        ? 'Se încarcă bălțile din zona ta'
        : '';
  const rowCount = sections.filter((s) => s.lakes.length > 0).length;
  const statusLine = busyLine || (homeData && rowCount ? `Bălți încărcate: ${plural(rowCount, 'secțiune', 'secțiuni')}` : '');

  function renderSection(section: LakeHomeSection, position: number) {
    return section.key === 'nearby' && section.nearbyPermissionPlaceholderMode ? (
      <NearbyPlaceholder
        key="nearby"
        mode={section.nearbyPermissionPlaceholderMode}
        position={position}
        onActivate={() => void activateNearby()}
        busy={location.locating}
      />
    ) : (
      <HomeRow
        key={section.key}
        section={section}
        position={position}
        seeAllHref={seeAllHref(section)}
        radiusAction={section.key === 'nearby' ? { label: `${Math.round(nearbyRadiusKm)} km`, href: nearbyHref } : null}
      />
    );
  }

  /* -------------------------------------------------------------- filter surface */
  // The kit's surface rule (Fundații §07): a sheet on a phone, a dialog on a tablet, from 1280 the
  // side panel — docked as T1 ListPage docks its aside: a sticky column beside the page, which
  // gives up its width while it is open, so the rails reflow to fewer tracks and nothing sits under
  // the panel. Not modal: the rows stay usable beside it.
  const surface = pickSurface('context', bp);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const filtersOpen = panel !== null;
  // The side panel is not modal (no focus trap of its own): focus goes in on open and back to
  // «Filtre» on close. The dialog and the sheet do both themselves.
  useEffect(() => {
    if (surface !== 'panel') return;
    if (filtersOpen) {
      const id = requestAnimationFrame(() => surfaceRef.current?.querySelector<HTMLElement>('aside button')?.focus());
      return () => cancelAnimationFrame(id);
    }
    returnTo.current?.focus();
    returnTo.current = null;
  }, [filtersOpen, surface]);

  const filterSection = panel ?? 'all';
  const filterBody = (gap: 'gap-5' | 'gap-6' = 'gap-6') => (
    <FiltersBody section={filterSection} draft={draft} setDraft={setDraft} committed={EMPTY_LAKE_FILTERS} catalogs={catalogs} gap={gap} />
  );
  const filterFooter = (
    <FiltersFooter
      canClear={draftHasSelection(filterSection, draft)}
      onClear={() => setDraft((d) => clearDraftSection(filterSection, d))}
      count={count}
      onApply={() => {
        setPanel(null);
        // fish: applying from the home always lands on the results map — filtered when something
        // is set, the all-lakes map otherwise (c6).
        openMap(DEFAULT_LAKES_COMMITTED_SEARCH, countLakeFilters(draft) > 0 ? draft : EMPTY_LAKE_FILTERS);
      }}
    />
  );

  // The docked panel stays mounted while it closes (its column animates to 0), then unmounts.
  const [panelMounted, setPanelMounted] = useState(false);
  if (surface === 'panel' && filtersOpen && !panelMounted) setPanelMounted(true);
  if (surface !== 'panel' && panelMounted) setPanelMounted(false);

  return (
    <>
      {/* The toolbar spans the page above the rows AND the docked panel: opening the panel never
          moves «Filtre» (which also closes it) from under the pointer. */}
      <HomeHeader
        searchRef={searchPillRef}
        onSearch={() => setSearchOpen(true)}
        filtersExpanded={filtersOpen}
        showMap={totalLakes > 0}
        onFilters={() => {
          // From 1280 the panel is docked, not modal: «Filtre» stays on screen and says
          // aria-expanded, so a second press closes it (the draft is not wiped under the user).
          if (panel !== null) return setPanel(null);
          returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setDraft(EMPTY_LAKE_FILTERS);
          setPanel('all');
        }}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] pt-4 md:pt-5">
        <div className="col-start-1 row-start-1 min-w-0">
          <p role="status" className="sr-only">
            {statusLine}
          </p>
          <div className="pb-28 md:pb-12" aria-busy={loading || undefined}>
            {body}
          </div>
        </div>

        {/* The docked side panel (from 1280), as T1 ListPage docks its aside: a sticky column beside
            the rows, which gives up its width while open, so the rails reflow to fewer tracks and
            nothing sits under it. Not modal: the rows stay usable beside it. Its column springs open
            and closed (Fundații §06: ease-medium, 300ms; opacity only, 120ms, under reduced motion)
            and unmounts once closed. Sticky under the stuck toolbar (top-16 + its 73px + the 20px
            gap the rows start with); its width is SidePanel's 420 + the 32px gutter. */}
        {surface === 'panel' && panelMounted ? (
          <div
            ref={surfaceRef}
            inert={!filtersOpen}
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && !filtersOpen) setPanelMounted(false);
            }}
            className={cn(
              'sticky top-39 z-sticky col-start-2 row-start-1 self-start overflow-hidden',
              'transition-[width,opacity] duration-(--duration-medium) ease-medium motion-reduce:transition-opacity motion-reduce:duration-120',
              filtersOpen ? 'w-113 opacity-100 starting:w-0 starting:opacity-0' : 'w-0 opacity-0',
            )}
          >
            <div className="w-113 pb-4 pl-8">
              <SidePanel
                title={filterPanelTitle(filterSection)}
                onClose={() => setPanel(null)}
                footer={filterFooter}
                className="max-h-[calc(100dvh-(--spacing(46)))] overflow-hidden rounded-card"
              >
                <div className="pt-2">{filterBody()}</div>
              </SidePanel>
            </div>
          </div>
        ) : null}
      </div>

      {totalLakes > 0 ? (
        // fish: the floating «Vezi bălțile pe hartă» (c23) — the all-lakes map, filters cleared. A
        // phone pattern: from 768 «Hartă» is in the header.
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(var(--spacing)*4,env(safe-area-inset-bottom))] z-sticky flex justify-center px-4 md:hidden">
          <Link
            href={routes.lakesMap()}
            className={buttonClass({ variant: 'primary', className: cn('pointer-events-auto gap-2 px-5.5', T2_FLOATING_BUTTON) })}
          >
            <MapIcon aria-hidden className="size-5 stroke-2" />
            Vezi bălțile pe hartă
          </Link>
        </div>
      ) : null}

      <SearchLayer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        anchorRef={searchPillRef}
        onCommit={(search) => {
          setSearchOpen(false);
          openMap(search);
        }}
        onLocationBlocked={locationDialog.onLocationBlocked}
      />

      {/* Below 1280, T1 FiltersSurface's surfaces with its exact metrics (the dialog's scrolling body
          over the fixed footer, gap-5; the sheet's gap-6), plus what it cannot take yet: the live
          «Aplică · N bălți» footer with «Șterge», and the phone sheet's «Închide» X (PhoneSheet).
          TODO(kit): a `footer` slot on T1 FiltersSurface; then this renders FiltersSurface. */}
      {surface === 'dialog' ? (
        <Dialog
          open={filtersOpen}
          onClose={() => setPanel(null)}
          title={filterPanelTitle(filterSection)}
          closeButton
          actions={filterFooter}
          className="max-h-[85dvh]"
        >
          <div className="-mx-5 mt-2 flex max-h-[60dvh] flex-col overflow-y-auto px-5 pb-1">{filterBody('gap-5')}</div>
        </Dialog>
      ) : surface === 'sheet' ? (
        <PhoneSheet open={filtersOpen} onClose={() => setPanel(null)} title={filterPanelTitle(filterSection)} footer={filterFooter}>
          <div className="pt-2">{filterBody('gap-6')}</div>
        </PhoneSheet>
      ) : null}

      <LocationDialog mode={locationDialog.mode} onClose={locationDialog.close} onRetry={locationDialog.onRetry} />
    </>
  );
}

/** A slot's own failure, inline in the rows (the rest of the page stays): the kit error card. */
function InlineError({
  title,
  error,
  attempt,
  onRetry,
  retrying,
}: {
  title: string;
  error: unknown;
  /** TanStack errorUpdateCount: a retry that fails again is said again. */
  attempt: number;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <ListError
      title={title}
      description={readErrorDescription(error)}
      onRetry={onRetry}
      retrying={retrying}
      retryLabel="Încearcă din nou"
      attempt={Math.max(1, attempt)}
    />
  );
}
