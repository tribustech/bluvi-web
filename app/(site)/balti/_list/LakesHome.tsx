'use client';

import { MapIcon } from '@heroicons/react/24/outline';
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/surfaces/Dialog';
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
  getFilteredLakes,
  getLakesByDocumentIds,
  getTotalLakesInSections,
  lakesHomeQuery,
  splitLakesHomeSections,
  type LakeFilterSection,
  type LakeFilterValues,
  type LakeHomeSection,
  type LakeHomeSectionLake,
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
import { CATEGORY_PARAM, categoryKeyFromSlug, categorySlug, filteredCategoryDefs, homeCategories, type FilteredResult } from './categories';
import { distanceLabel } from './distance';
import { CategoryBar, HomeGrid, HomeGridSkeleton, RecentStrip } from './HomeGrid';
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
/** A filtered category's grid: its first page (the map holds the rest). */
const CATEGORY_PAGE = 24;
const CATEGORY_STALE_MS = 10 * 60 * 1000;

export function LakesHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  // Always read: the categories (Crap, Somn, noaptea, cazare) are built from the catalogues.
  const catalogs = useFilterCatalogs(t);
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

  /* -------------------------------------------------------------- categories (owner rule 5) */
  // The icon row over the grid: picked in place (router.replace, no new page), and kept in the URL
  // (`?categorie=crap`, ./categories.tsx) so a reload or a shared link reopens the same grid.
  // «Recomandate» on a phone keeps fish's rails; any other category (and «Recomandate» from 768)
  // is one dense grid. The pick shows at once; the URL catches up a moment later.
  const urlCategoryKey = categoryKeyFromSlug(searchParams.get(CATEGORY_PARAM));
  // The pick, until the URL it was made from changes (the replace landed, or another navigation).
  const [pick, setPick] = useState<{ key: string; from: string } | null>(null);
  const categoryKey = pick && pick.from === urlCategoryKey ? pick.key : urlCategoryKey;
  const pickCategory = (key: string) => {
    setPick({ key, from: urlCategoryKey });
    const next = new URLSearchParams(searchParams.toString());
    const slug = categorySlug(key);
    if (slug) next.set(CATEGORY_PARAM, slug);
    else next.delete(CATEGORY_PARAM);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const defs = useMemo(
    () => filteredCategoryDefs({ fishOptions: catalogs.fishOptions, facilityOptions: catalogs.facilityOptions }),
    [catalogs.fishOptions, catalogs.facilityOptions],
  );
  // The whole catalogue for each filtered category (/feed/lakes/filtered, edge-cached): its first
  // grid page and the CMS's total. Read with the home, so a pick is instant and an empty one is
  // never offered.
  const filteredReads = useQueries({
    queries: defs.map((def) => ({
      queryKey: ['lakes', 'home', 'category', def.key, JSON.stringify(def.filters), CATEGORY_PAGE] as const,
      queryFn: () => getFilteredLakes(t, { page: 1, pageSize: CATEGORY_PAGE, filters: def.filters }),
      staleTime: CATEGORY_STALE_MS,
      gcTime: CATEGORY_STALE_MS,
      enabled: Boolean(homeData),
    })),
  });
  const filtered = defs.map((def, i) => {
    const q = filteredReads[i]!;
    const result: FilteredResult = q.data
      ? { lakes: q.data.data, total: q.data.meta.pagination.total }
      : q.isError
        ? 'failed'
        : 'pending';
    return { def, result };
  });
  const categories = homeCategories({
    sections,
    seeAllHref,
    // The nearby chip: fish's placeholder modes ask; a granted read in flight waits; a granted read
    // with no lake in range has nothing to show (rule 4) — and while the permission is unknown,
    // nothing is promised either.
    nearby: !location.known ? null : location.state === 'granted' ? (nearbyPending ? 'pending' : null) : 'locate',
    filtered,
  });
  const found = categories.find((c) => c.key === categoryKey) ?? null;
  // A category from the URL whose chip is not known yet (the catalogues or its read still in
  // flight, the location permission not read): its grid's skeleton, never «Recomandate» flashing
  // first. Once everything answered, an unknown or empty one falls back to «Recomandate».
  const categoryWaiting =
    !found &&
    categoryKey !== 'all' &&
    (catalogs.fishes.isPending ||
      catalogs.facilities.isPending ||
      filteredReads.some((q) => q.isPending) ||
      (categoryKey === 'nearby' && (!location.known || nearbyPending)) ||
      (categoryKey === 'cabins' && !homeData));
  const category = found ?? (categoryWaiting ? null : (categories[0] ?? null));
  const picked = category && category.key !== 'all' ? category : null;
  const nearbyKm = new Map(
    (sections.find((s) => s.key === 'nearby')?.lakes ?? []).map((l) => [l.documentId, (l as { distanceKm?: number }).distanceKm]),
  );
  const distanceOf = (lake: LakeHomeSectionLake) => {
    const km = nearbyKm.get(lake.documentId);
    return km == null ? null : distanceLabel(km);
  };

  /* -------------------------------------------------------------- body */
  const recentFailed = ids.length > 0 && recent.isError && !recent.data;
  // Secondary reads that failed are hidden, then retried quietly (no card, no focus move).
  useQuietRetry(nearbyFailed, home.refetch);
  useQuietRetry(recentFailed, recent.refetch);
  const recentPending = ids.length > 0 && recent.isPending;
  const loading = !homeData && home.isPending;
  const rowsRef = useRef<HTMLDivElement>(null);
  const armRetryFocus = useFocusAfterRetry(Boolean(homeData) && !loading, () => rowsRef.current?.querySelector<HTMLElement>('h2') ?? null);
  const retryHome = () => {
    armRetryFocus();
    void home.refetch();
  };
  let body: ReactNode;
  if (loading) {
    body = (
      <>
        <div className="md:hidden">
          <HomeSkeleton nearbySlot={location.state === 'granted' ? 'row' : 'placeholder'} />
        </div>
        <div aria-hidden className="max-md:hidden">
          <HomeGridSkeleton />
        </div>
      </>
    );
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
    // located read runs. A failed located read hides the slot (owner rule 4, ROADMAP §4b: when we
    // don't know, we don't show) — the rows stay, and a quiet retry runs in the background.
    const nearbySlot: ReactNode = sections.some((s) => s.key === 'nearby') ? null : !location.known ? (
      <NearbySlotSkeleton key="nearby-slot" phoneOnly />
    ) : nearbyPending ? (
      <div key="nearby-slot" className="md:hidden">
        <SlotRowSkeleton />
      </div>
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
    // A failed /lakes/by-ids read hides «Vizualizate recent» (rule 4; the rows below stay, a quiet
    // retry runs in the background).
    if (recentPending) blocks.push(<SlotRowSkeleton key="recent-slot" compact />);
    let nearbyPlaced = false;
    const placeNearby = () => {
      if (nearbyPlaced) return;
      nearbyPlaced = true;
      if (nearbySlot) blocks.push(nearbySlot);
      if (homeError) blocks.push(homeError);
    };
    if (categoryWaiting) {
      blocks.push(<HomeGridSkeleton key={`grid-${categoryKey}-skeleton`} />);
    } else if (picked) {
      // A picked category: its grid alone, at every width — or, for «Aproape de tine» without a
      // position, fish's placeholder that asks for it (then the grid once the row is in).
      blocks.length = 0;
      if (picked.state === 'locate') {
        const mode = location.state === 'denied' ? 'denied' : location.state === 'services_off' ? 'services_off' : 'never_asked';
        blocks.push(
          <NearbyPlaceholder key="nearby-locate" mode={mode} position={1} onActivate={() => void activateNearby()} busy={location.locating} />,
        );
        // Under it, until the position arrives, the recommended grid with its own heading (rule 5:
        // a list page stays dense — never a banner over an empty page). The nearby grid replaces
        // both once the row is in.
        const all = categories.find((c) => c.key === 'all');
        if (all) blocks.push(<HomeGrid key="grid-all" category={all} position={categories.indexOf(all) + 1} distanceOf={distanceOf} />);
      } else if (picked.state === 'pending') {
        blocks.push(<HomeGridSkeleton key={`grid-${picked.key}-skeleton`} />);
      } else {
        blocks.push(
          <HomeGrid
            key={`grid-${picked.key}`}
            category={picked}
            position={categories.indexOf(picked) + 1}
            distanceOf={distanceOf}
            // lakes.home.c12: the nearby set's header link is the radius, to the nearby map.
            radiusAction={picked.key === 'nearby' && position ? { label: `${Math.round(nearbyRadiusKm)} km`, href: nearbyHref } : null}
          />,
        );
      }
    } else {
      sections.forEach((section, i) => {
        if (section.key !== 'recent_viewed') placeNearby();
        if (section.key === 'recent_viewed') {
          // Phone: fish's compact rail. From 768: a compact strip (rule 5, no near-empty rail).
          blocks.push(
            <div key="recent-phone" className="md:hidden">
              {renderSection(section, i + 1)}
            </div>,
            <RecentStrip key="recent-wide" lakes={section.lakes} className="max-md:hidden" />,
          );
        } else if (section.key === 'nearby') {
          // fish's rail on a phone. From 768 there is no nearby block over the grid (rule 5: one
          // grid, one card design, no first row twice): the nearby lakes carry their distance in
          // «Bălți recomandate», and «Aproape de tine» is their own grid, nearest first, with the
          // «50 km ›» map link. Nothing is reserved for it there, so the grid never jumps when the
          // position arrives. The location placeholder is fish's card on a phone; from 768 it is the
          // «Aproape de tine» category (no full-width band between the categories and the grid).
          blocks.push(
            <div key="nearby" className="md:hidden">
              {renderSection(section, i + 1)}
            </div>,
          );
        } else {
          // The CMS rows are fish's rails on a phone; from 768 their lakes are the grid below.
          blocks.push(
            <div key={section.key} className="md:hidden">
              {renderSection(section, i + 1)}
            </div>,
          );
        }
      });
      placeNearby();
      if (category) {
        blocks.push(
          <HomeGrid key="grid-all" category={category} position={categories.indexOf(category) + 1} distanceOf={distanceOf} className="max-md:hidden" />,
        );
      }
    }
    body = (
      // `@container`: the rails size their tracks from this column (HorizontalRail RAIL_GRID, 100cqw).
      <div ref={rowsRef} className="@container flex flex-col gap-7 xl:gap-9">
        {blocks}
        {!sections.length && !homeError && !recentPending && !nearbySlot ? (
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
        impressionReady={location.known}
        radiusAction={section.key === 'nearby' ? { label: `${Math.round(nearbyRadiusKm)} km`, href: nearbyHref } : null}
      />
    );
  }

  /* -------------------------------------------------------------- filter surface */
  // Owner rule 2 (ROADMAP §4b): the filters open from the horizontal bar (the header's «Filtre» and
  // its quick chips) in a Sheet on a phone and a Dialog from 768 — never a column beside the rows.
  const surface = bp === 'mobile' ? 'sheet' : 'dialog';
  const filtersOpen = panel !== null;
  const openPanel = (section: LakeFilterSection) => {
    setDraft(EMPTY_LAKE_FILTERS);
    setPanel(section);
  };

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

  return (
    <>
      <HomeHeader
        searchRef={searchPillRef}
        onSearch={() => setSearchOpen(true)}
        filtersExpanded={panel === 'all'}
        onSection={openPanel}
        sectionExpanded={panel === 'fish' || panel === 'regime' ? panel : null}
        showMap={totalLakes > 0}
        onFilters={() => openPanel('all')}
        categories={<CategoryBar categories={categories} current={category?.key ?? categoryKey} onPick={pickCategory} />}
      />

      <div className="pt-4 md:pt-5">
        <p role="status" className="sr-only">
          {statusLine}
        </p>
        <div className="pb-28 md:pb-12" aria-busy={loading || undefined}>
          {body}
        </div>
      </div>

      {totalLakes > 0 ? (
        // fish: the floating map button (c23) — the all-lakes map, filters cleared; «Arată harta»
        // (owner rule 6). A phone pattern: from 768 it is the header's primary action.
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(var(--spacing)*4,env(safe-area-inset-bottom))] z-sticky flex justify-center px-4 md:hidden">
          <Link
            href={routes.lakesMap()}
            className={buttonClass({ variant: 'primary', className: cn('pointer-events-auto gap-2 px-5.5', T2_FLOATING_BUTTON) })}
          >
            <MapIcon aria-hidden className="size-5 stroke-2" />
            Arată harta
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

      {/* T1 FiltersSurface's surfaces with its exact metrics (the dialog's scrolling body over the
          fixed footer, gap-5; the sheet's gap-6), plus what it cannot take yet: the live
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

const QUIET_RETRY_MS = 30_000;

/** While `failed`, refetch every 30 s without a word on screen (a hidden secondary block). */
function useQuietRetry(failed: boolean, refetch: () => unknown) {
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  });
  useEffect(() => {
    if (!failed) return;
    const id = window.setInterval(() => void ref.current(), QUIET_RETRY_MS);
    return () => window.clearInterval(id);
  }, [failed]);
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
