'use client';

import { CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusAfterRetry } from './errors';
import { ChoiceChips, TextAction } from '@/components/templates/T1';
import { T2CheckChips } from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { plural } from '@/components/cards/format';
import {
  EMPTY_LAKE_FILTERS,
  facilitiesQuery,
  fishesQuery,
  getRatingTierLabel,
  getRegimeOptions,
  LAKES_EXPLORE_COUNT_DEBOUNCE_MS,
  lakesExploreCountQuery,
  mapFacilitiesToFilterValues,
  mapFishToFilterValues,
  RATING_TIER_ORDER,
  type LakeFilterSection,
  type LakeFilterValue,
  type LakeFilterValues,
  type LakeRatingTier,
  type LakesCommittedSearch,
} from '@/core/lakes';
import type { Transport } from '@/core/transport';
import { facilityIcon } from '@/app/(site)/_home/facilityIcon';
import { FishGlyph, hasFishGlyph } from './fishGlyphs';
import { FishOutlineIcon } from '@/components/nav/brand';
import { RepeatIcon } from './icons';

/*
 * lakes.filters — fish features/lakes/components/LakeFilterPickerSheet.tsx: the filter sections
 * (Regim, Facilități, Rating, Rezervări, Pești) on the kit's filter parts — T1 FilterSection
 * (fieldset + legend), T2CheckChips for the multi-selects, T1 ChoiceChips (radios) for the rating,
 * a one-pill T2CheckChips for Rezervări (fish's on/off option pill) — a draft until «Aplică», the live result count on the
 * button. The page puts it in its surface: T2Panel on the map (a sheet on a phone,
 * a dialog from 768 — owner rule 2: never a column over the list), the Sheet / Dialog on the Bălți home.
 */

export const FILTER_SECTION_TITLES: Record<Exclude<LakeFilterSection, 'all'>, string> = {
  regime: 'Regim',
  facilities: 'Facilități',
  rating: 'Rating',
  booking: 'Rezervări',
  fish: 'Pești',
};

export function filterPanelTitle(section: LakeFilterSection): string {
  return section === 'all' ? 'Filtre' : FILTER_SECTION_TITLES[section];
}

/** The catalogs behind Facilități and Pești (cached 3h, fish useFacilities / useFishes). */
export function useFilterCatalogs(t: Transport, enabled = true) {
  const facilities = useQuery({ ...facilitiesQuery(t), enabled });
  const fishes = useQuery({ ...fishesQuery(t), enabled });
  const facilityOptions = useMemo(() => mapFacilitiesToFilterValues(facilities.data), [facilities.data]);
  const fishOptions = useMemo(() => mapFishToFilterValues(fishes.data), [fishes.data]);
  return { facilities, fishes, facilityOptions, fishOptions };
}

export type FilterCatalogs = ReturnType<typeof useFilterCatalogs>;

/** fish selectedFirst: committed options lead a long section, so a clipped row never hides a pick. */
function selectedFirst(options: LakeFilterValue[], committed: LakeFilterValue[]): LakeFilterValue[] {
  const ids = new Set(committed.map((v) => v.documentId));
  if (!ids.size) return options;
  return [...options.filter((o) => ids.has(o.documentId)), ...options.filter((o) => !ids.has(o.documentId))];
}

function toggleValue(list: LakeFilterValue[], value: LakeFilterValue): LakeFilterValue[] {
  return list.some((v) => v.documentId === value.documentId) ? list.filter((v) => v.documentId !== value.documentId) : [...list, value];
}

/** Whether the shown section(s) of the draft have anything selected («Șterge» is disabled without). */
export function draftHasSelection(section: LakeFilterSection, d: LakeFilterValues): boolean {
  switch (section) {
    case 'regime':
      return d.selectedRegimes.length > 0;
    case 'fish':
      return d.selectedFish.length > 0;
    case 'facilities':
      return d.selectedFacilities.length > 0;
    case 'rating':
      return d.ratingTier != null;
    case 'booking':
      return d.bookableOnly;
    default:
      return d.selectedRegimes.length + d.selectedFish.length + d.selectedFacilities.length > 0 || d.ratingTier != null || d.bookableOnly;
  }
}

/** fish clearDraft: the shown section, or everything in all-mode. */
export function clearDraftSection(section: LakeFilterSection, d: LakeFilterValues): LakeFilterValues {
  switch (section) {
    case 'regime':
      return { ...d, selectedRegimes: [] };
    case 'fish':
      return { ...d, selectedFish: [] };
    case 'facilities':
      return { ...d, selectedFacilities: [] };
    case 'rating':
      return { ...d, ratingTier: null };
    case 'booking':
      return { ...d, bookableOnly: false };
    default:
      return EMPTY_LAKE_FILTERS;
  }
}

/**
 * The live count of the draft for the current search (fish useLakesExploreCount: debounced, the
 * button reads plain «Aplică» while counting).
 */
export function useDraftCount(t: Transport, search: LakesCommittedSearch, draft: LakeFilterValues, enabled: boolean): number | null {
  const [settled, setSettled] = useState(draft);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(draft), LAKES_EXPLORE_COUNT_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft]);
  const debouncing = settled !== draft;
  const q = useQuery(lakesExploreCountQuery(t, { search, filters: settled }, enabled && !debouncing));
  if (debouncing || q.isFetching || q.data == null) return null;
  return q.data;
}

/** «Aplică · 12 bălți» — plain «Aplică» while the count is unknown. */
export function applyLabel(count: number | null): string {
  return count == null ? 'Aplică' : `Aplică · ${plural(count, 'baltă', 'bălți')}`;
}

/**
 * The sticky footer: «Șterge» (the shown section) and «Aplică · N bălți» — the kit FiltersSurface
 * footer (T1 TextAction for the reset, a full-width Button in a flex-1 slot), at every width.
 */
export function FiltersFooter({
  canClear,
  onClear,
  onApply,
  count,
}: {
  canClear: boolean;
  onClear: () => void;
  onApply: () => void;
  count: number | null;
}) {
  return (
    <div className="flex w-full items-center gap-4">
      <TextAction onClick={onClear} disabled={!canClear}>
        Șterge
      </TextAction>
      <div className="min-w-0 flex-1">
        <Button block onClick={onApply}>
          <span aria-live="polite">{applyLabel(count)}</span>
        </Button>
      </div>
    </div>
  );
}

/** Four rows of 36px pills with 8px gaps (fish COLLAPSED_ROWS × CHIP_HEIGHT; the kit pills are h-9). */
const COLLAPSED_PX = 4 * 36 + 3 * 8;

/**
 * fish ChipGroup's clip for a long group (Facilități, Pești): four rows of the kit pills, then a
 * «Vezi toate … (N)» / «Vezi mai puțin» pill. Pills in the clipped rows stay in the DOM (their
 * measured height decides whether the pill is needed) but are inert: out of the tab order and the
 * accessibility tree (lakes.filters.c5).
 * TODO(kit): a `collapsedRows` prop on T2CheckChips (public waters needs it too) — the kit file is
 * outside this task.
 */
function CollapsedRows({ children, expandLabel }: { children: ReactNode; expandLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const group = el?.firstElementChild as HTMLElement | null;
    if (!el || !group) return;
    const measure = () => {
      setOverflows(group.scrollHeight > COLLAPSED_PX + 1);
      for (const item of [...group.children] as HTMLElement[]) {
        item.inert = !expanded && item.offsetTop - group.offsetTop + item.offsetHeight > COLLAPSED_PX + 1;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(group);
    return () => ro.disconnect();
  }, [expanded, children]);
  const clipped = !expanded && overflows;
  return (
    <div className="flex flex-col gap-2">
      {/* p-0.5/-m-0.5: room for the pills' focus ring inside the clip. */}
      <div ref={ref} className={cn('-m-0.5 p-0.5', clipped && 'max-h-43 overflow-hidden')}>
        {children}
      </div>
      {overflows ? (
        <div>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-accent-tint-3 bg-surface px-3.5 t-label text-accent-ink',
              'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint active:opacity-80',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          >
            {expanded ? 'Vezi mai puțin' : expandLabel}
            {expanded ? <ChevronUpIcon aria-hidden className="size-3.5 stroke-2" /> : <ChevronDownIcon aria-hidden className="size-3.5 stroke-2" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * fish SectionHeader + SelectAllAction: a fieldset named by its legend, the caps title (with the
 * count, «Regim · 1») and the select-all on ONE row (the ColumnHeader pattern). The kit
 * FilterSection's legend has no action slot, so the legend is for screen readers and the row is
 * drawn here in the same step (t-eyebrow, muted caps). TODO(kit): an `action` slot on T1
 * FilterSection. The action keeps the kit's 36px box but is pulled out of the row's height (-my-2),
 * so its hover fill stays in the gap above the pills.
 *
 * `showTitle` false (a chip opened this one section; the panel title already names it): fish shows
 * only the select-all, and no row at all when there is none.
 */
function Section({
  title,
  count = 0,
  action,
  showTitle = true,
  busy = false,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  showTitle?: boolean;
  /** Its options are loading (a first read or a retry). */
  busy?: boolean;
  children: ReactNode;
}) {
  const label = count ? `${title} · ${count}` : title;
  return (
    <fieldset aria-busy={busy || undefined} className="flex min-w-0 flex-col gap-2.5">
      <legend className="sr-only">{label}</legend>
      {showTitle || action ? (
        <div className={cn('flex min-h-5 items-center gap-2', showTitle ? 'justify-between' : 'justify-end')}>
          {showTitle ? (
            <span aria-hidden className="t-eyebrow text-muted uppercase">
              {label}
            </span>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </fieldset>
  );
}

function SelectAll({
  allSelected,
  onToggle,
  name,
  pending = false,
}: {
  allSelected: boolean;
  onToggle: () => void;
  name: string;
  /** The options are still loading: the action's place is held (disabled), so the row does not change. */
  pending?: boolean;
}) {
  const label = allSelected && !pending ? 'Deselectează tot' : 'Selectează tot';
  return (
    <TextAction onClick={onToggle} disabled={pending} aria-label={`${label}: ${name}`} className="-my-2">
      {label}
    </TextAction>
  );
}

/** A filter value as a kit check pill (keyed by documentId: URL values and catalog values agree). */
type Pill = { id: string; name: string; value: LakeFilterValue };
const toPills = (values: LakeFilterValue[]): Pill[] => values.map((value) => ({ id: value.documentId, name: value.name, value }));

/** Pill widths of the catalog skeleton: enough to fill four rows at the widest surface. */
const SKELETON_PILLS = ['w-20', 'w-28', 'w-24', 'w-18', 'w-26', 'w-22', 'w-30', 'w-20', 'w-24', 'w-28', 'w-18', 'w-26', 'w-22', 'w-24', 'w-20', 'w-28', 'w-24', 'w-22'];

const RATING_ANY = 'any';
const BOOKABLE_PILL = { id: 'bookable', name: 'Acceptă rezervări online' };

type CatalogQuery = { isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => unknown };

/**
 * A catalog is loading on its first read and on a retry after a failure (TanStack keeps status
 * «error» while it refetches, so isPending alone would leave a dead «Încearcă din nou»).
 */
function catalogLoading(q: CatalogQuery): boolean {
  return q.isPending || (q.isError && q.isFetching);
}

/**
 * A catalog section's options, or the state in their place: while loading the collapsed group's
 * exact box — four rows of pills (clipped) and the «Vezi toate» pill — so the sections under it do
 * not move when it arrives; a failure with the page's one retry (the kit compact secondary Button,
 * as the ⌘K palette's); an empty catalog. A retry keeps the keyboard user's place: focus goes to the
 * first pill when the options arrive, back to the retry when it fails again (WCAG 2.4.3).
 */
function Catalog({ q, count, noun, children }: { q: CatalogQuery; count: number; noun: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const loading = catalogLoading(q);
  const armRetryFocus = useFocusAfterRetry(!loading, () => ref.current?.querySelector<HTMLElement>(count ? 'input' : 'button') ?? null);
  let body: ReactNode = children;
  if (!count) {
    body = loading ? (
      <div aria-hidden className="flex flex-col gap-2">
        <div className="flex h-42 flex-wrap content-start gap-2 overflow-hidden">
          {SKELETON_PILLS.map((w, i) => (
            <span key={i} className={cn('h-9 animate-shimmer rounded-full', w)} />
          ))}
        </div>
        <span className="h-9 w-48 animate-shimmer rounded-full" />
      </div>
    ) : q.isError ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="t-caption text-muted">{`Lista de ${noun} nu s-a încărcat.`}</p>
        <Button
          variant="secondary"
          size="compact"
          onClick={() => {
            armRetryFocus();
            void q.refetch();
          }}
        >
          Încearcă din nou
        </Button>
      </div>
    ) : (
      <p className="t-caption text-muted">Nicio opțiune momentan.</p>
    );
  }
  return (
    <div ref={ref} className="contents">
      {body}
    </div>
  );
}


/** The panel body for `section` («all» stacks every section in fish order). */
export function FiltersBody({
  section,
  draft,
  setDraft,
  committed,
  catalogs,
  gap = 'gap-6',
}: {
  section: LakeFilterSection;
  draft: LakeFilterValues;
  setDraft: (update: (d: LakeFilterValues) => LakeFilterValues) => void;
  /** The applied filters (frozen while the panel is open): orders the long sections. */
  committed: LakeFilterValues;
  catalogs: FilterCatalogs;
  /** The sections' gap: the host surface's (T1 FiltersSurface: gap-5 in its dialog, gap-6 in its sheet). */
  gap?: 'gap-5' | 'gap-6';
}) {
  const isAll = section === 'all';
  const show = (key: Exclude<LakeFilterSection, 'all'>) => isAll || section === key;
  const regimeOptions = useMemo(() => getRegimeOptions(), []);
  const facilityOptions = useMemo(
    () => selectedFirst(catalogs.facilityOptions, committed.selectedFacilities),
    [catalogs.facilityOptions, committed.selectedFacilities],
  );
  const fishOptions = useMemo(() => selectedFirst(catalogs.fishOptions, committed.selectedFish), [catalogs.fishOptions, committed.selectedFish]);
  const toggleAll = (selected: LakeFilterValue[], options: LakeFilterValue[]) => (selected.length >= options.length ? [] : options);

  const regimePills = toPills(regimeOptions);
  const facilityPills = toPills(facilityOptions);
  const fishPills = toPills(fishOptions);

  return (
    <div className={cn('flex flex-col pt-1 pb-2', gap)}>
      {show('regime') ? (
        <Section
          showTitle={isAll}
          title={FILTER_SECTION_TITLES.regime}
          count={draft.selectedRegimes.length}
          action={
            <SelectAll
              name={FILTER_SECTION_TITLES.regime}
              allSelected={draft.selectedRegimes.length >= regimeOptions.length}
              onToggle={() => setDraft((d) => ({ ...d, selectedRegimes: toggleAll(d.selectedRegimes, regimeOptions) }))}
            />
          }
        >
          <T2CheckChips
            options={regimePills}
            selected={toPills(draft.selectedRegimes)}
            onToggle={(o) => setDraft((d) => ({ ...d, selectedRegimes: toggleValue(d.selectedRegimes, o.value) }))}
            leading={() => <FishOutlineIcon />}
          />
        </Section>
      ) : null}

      {show('facilities') ? (
        <Section
          showTitle={isAll}
          title={FILTER_SECTION_TITLES.facilities}
          count={draft.selectedFacilities.length}
          busy={catalogLoading(catalogs.facilities)}
          action={
            facilityOptions.length || catalogLoading(catalogs.facilities) ? (
              <SelectAll
                pending={catalogLoading(catalogs.facilities)}
                name={FILTER_SECTION_TITLES.facilities}
                allSelected={draft.selectedFacilities.length >= facilityOptions.length}
                onToggle={() => setDraft((d) => ({ ...d, selectedFacilities: toggleAll(d.selectedFacilities, facilityOptions) }))}
              />
            ) : null
          }
        >
          <Catalog q={catalogs.facilities} count={facilityOptions.length} noun="facilități">
            <CollapsedRows expandLabel={`Vezi toate facilitățile (${facilityOptions.length})`}>
              <T2CheckChips
                options={facilityPills}
                selected={toPills(draft.selectedFacilities)}
                onToggle={(o) => setDraft((d) => ({ ...d, selectedFacilities: toggleValue(d.selectedFacilities, o.value) }))}
                leading={(o) => {
                  const Icon = facilityIcon(o.name);
                  return <Icon aria-hidden />;
                }}
              />
            </CollapsedRows>
          </Catalog>
        </Section>
      ) : null}

      {show('rating') ? (
        // Single choice (native radios): «Orice» is its clear, so no select-all.
        <Section title={FILTER_SECTION_TITLES.rating} showTitle={isAll}>
          <ChoiceChips<string>
            name="lakes-rating"
            value={draft.ratingTier ?? RATING_ANY}
            onChange={(v) => setDraft((d) => ({ ...d, ratingTier: v === RATING_ANY ? null : (v as LakeRatingTier) }))}
            options={[
              { value: RATING_ANY, label: 'Orice', leading: <StarIcon className="size-4" /> },
              // fish: the worded tier (the same word the rail chip shows once picked).
              ...RATING_TIER_ORDER.map((tier) => ({
                value: tier,
                label: getRatingTierLabel(tier),
                leading: <StarSolidIcon className="size-4 text-rating" />,
              })),
            ]}
          />
        </Section>
      ) : null}

      {show('booking') ? (
        <Section title={FILTER_SECTION_TITLES.booking} showTitle={isAll}>
          {/* fish: one on/off option pill, like every other section's (lakes.filters.c8). */}
          <T2CheckChips
            options={[BOOKABLE_PILL]}
            selected={draft.bookableOnly ? [BOOKABLE_PILL] : []}
            onToggle={() => setDraft((d) => ({ ...d, bookableOnly: !d.bookableOnly }))}
            leading={() => <CalendarDaysIcon />}
          />
        </Section>
      ) : null}

      {show('fish') ? (
        <Section
          showTitle={isAll}
          title={FILTER_SECTION_TITLES.fish}
          count={draft.selectedFish.length}
          busy={catalogLoading(catalogs.fishes)}
          action={
            fishOptions.length || catalogLoading(catalogs.fishes) ? (
              <SelectAll
                pending={catalogLoading(catalogs.fishes)}
                name={FILTER_SECTION_TITLES.fish}
                allSelected={draft.selectedFish.length >= fishOptions.length}
                onToggle={() => setDraft((d) => ({ ...d, selectedFish: toggleAll(d.selectedFish, fishOptions) }))}
              />
            ) : null
          }
        >
          <Catalog q={catalogs.fishes} count={fishOptions.length} noun="pești">
            <CollapsedRows expandLabel={`Vezi toți peștii (${fishOptions.length})`}>
              <T2CheckChips
                options={fishPills}
                selected={toPills(draft.selectedFish)}
                onToggle={(o) => setDraft((d) => ({ ...d, selectedFish: toggleValue(d.selectedFish, o.value) }))}
                // fish FishOptionIcon: the species glyph where there is one, the generic fish otherwise.
                leading={(o) => (hasFishGlyph(o.name) ? <FishGlyph name={o.name} /> : <FishOutlineIcon />)}
              />
            </CollapsedRows>
          </Catalog>
        </Section>
      ) : null}
    </div>
  );
}

/** The rail chip icons (fish LakesResultsWithMap baltiChips). */
export const CHIP_ICONS: Record<Exclude<LakeFilterSection, 'all'>, ReactNode> = {
  regime: <RepeatIcon />,
  facilities: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  rating: <StarIcon aria-hidden />,
  booking: <CalendarDaysIcon aria-hidden />,
  fish: <FishOutlineIcon />,
};
