'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SignalIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { ChoiceChips, FilterSection, FilterSwitch, FOCUS_RING, LiveDot, SEARCH_SHELL, TextAction, type Choice } from '@/components/templates/T1';
import { RING_SELECTED } from '@/components/templates/rings';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { localDayKey, type DayRange } from '@/core/booking';
import {
  competitionCardsInfiniteQuery,
  countyListComplete,
  countyOptions,
  customPeriodValue,
  DEFAULT_COMPETITION_FILTERS,
  filterCounties,
  formatCount,
  hasActiveFilters,
  MAX_COUNTY_PAGES,
  parseCustomPeriod,
  periodChipLabel,
  periodFitsStatus,
  periodOptions,
  selectCompetitionCards,
  type CompetitionCardsScope,
  type CompetitionFilterValues,
  type CompetitionsCommittedSearch,
} from '@/core/competitions';
import { flattenLakesExploreSuggestions, lakesExploreSuggestionsInfiniteQuery } from '@/core/lakes';
import type { Transport } from '@/core/transport';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import type { Status } from './place';
import { RangeCalendar } from './RangeCalendar';

/*
 * competitions-list.filters — fish features/competitions/components/CompetitionFiltersSheet.tsx:
 * «when and how», never «where or who» (that is the search). Everything is a draft until «Arată …»,
 * whose count previews the draft; Județ and Perioadă are sub-views of the same dialog (fish: a second
 * view inside the sheet, never a stacked one).
 *
 * `entry` lets a quick chip of the filter bar (Județ, «Alege din calendar») open a sub-view on its
 * own: a county pick or the range's «Aplică» then applies at once and closes, and the way back is
 * the close.
 */

export type FiltersView = 'filters' | 'county' | 'range';

const HEADER_TITLE: Record<FiltersView, string> = { filters: 'Filtre', county: 'Județ', range: 'Perioadă' };

const STATUS_CHOICES: Choice<Status>[] = [
  { value: 'all', label: 'Orice stare' },
  { value: 'notStarted', label: 'Viitoare' },
  { value: 'started', label: 'Live', leading: <LiveDot /> },
  { value: 'completed', label: 'Încheiate' },
];

const FORMAT_CHOICES: Choice<CompetitionFilterValues['format']>[] = [
  { value: 'all', label: 'Orice format' },
  { value: 'single', label: 'Individual' },
  { value: 'team', label: 'Echipe' },
];

/** The section glyphs (fish CATEGORY_ICON), muted like the legend (FilterSection). */
export const SECTION_ICON = {
  status: <SignalIcon />,
  period: <CalendarDaysIcon />,
  format: <UsersIcon />,
  county: <MapPinIcon />,
};

/** 'yyyy-MM-dd' back to a local Date — the calendar speaks day keys, the wire speaks Dates. */
function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** A stored custom period as the calendar's day range ({} for anything else). */
function rangeOf(period: string): DayRange {
  const custom = parseCustomPeriod(period);
  return custom ? { startDate: localDayKey(custom.from), endDate: localDayKey(custom.to) } : {};
}

/** The period choices for a state, with a stored value the presets no longer offer kept visible. */
export function periodChoices(period: string, status: Status, now: Date): Choice<string>[] {
  const presets = periodOptions(now, status).map((p) => {
    const [label, detail] = p.label.split(' · ');
    return detail ? { value: p.value, label, detail } : { value: p.value, label: p.label };
  });
  // A custom range is the calendar row's, never a pill (fish: the presets and the picker row).
  if (parseCustomPeriod(period) || presets.some((p) => p.value === period)) return presets;
  return [...presets, { value: period, label: periodChipLabel(period, now) }];
}

export function FiltersDialog({
  open,
  onClose,
  entry = 'filters',
  values,
  status,
  scope,
  search,
  t,
  isAuthenticated,
  now,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** 'filters' from «Filtre»; 'county' / 'range' straight from a quick chip. */
  entry?: FiltersView;
  /** The committed filters and status — every opening starts its draft from them (c1). */
  values: CompetitionFilterValues;
  status: Status;
  scope: CompetitionCardsScope;
  search: CompetitionsCommittedSearch;
  t: Transport;
  isAuthenticated: boolean;
  now: Date;
  onApply: (values: CompetitionFilterValues, status: Status) => void;
}) {
  // Every opening starts over from what is committed: the entry view, the draft, the range (c1).
  const [view, setView] = useState<FiltersView>(entry);
  const [draft, setDraft] = useState(values);
  const [draftStatus, setDraftStatus] = useState<Status>(status);
  const [range, setRange] = useState<DayRange>(() => rangeOf(values.period));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView(entry);
      setDraft(values);
      setDraftStatus(status);
      setRange(rangeOf(values.period));
    }
  }

  const standalone = entry !== 'filters';
  const customRange = parseCustomPeriod(draft.period);
  const bp = useBreakpoint();

  // Switching sub-views unmounts the control that was used: focus follows the view (the county
  // field, the range's instruction line — both on mount, below), and back on «Filtre» it returns to
  // the row that opened the sub-view, never to <body>.
  const uid = useId();
  const rowId = { range: `${uid}-range`, county: `${uid}-county` };
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    const id = returnTo.current;
    if (!id || view !== 'filters') return;
    returnTo.current = null;
    document.getElementById(id)?.focus();
  });
  const backToFilters = (from: 'range' | 'county') => {
    returnTo.current = rowId[from];
    setView('filters');
  };

  const openRange = () => {
    setRange(rangeOf(draft.period));
    setView('range');
  };

  // c4: a state the chosen period cannot describe sends the period back to «Oricând».
  const changeDraftStatus = (next: Status) => {
    setDraftStatus(next);
    if (!periodFitsStatus(draft.period, next, now)) setDraft((d) => ({ ...d, period: 'all' }));
  };

  const confirmRange = () => {
    if (!range.startDate || !range.endDate) return;
    const period = customPeriodValue(fromDayKey(range.startDate), fromDayKey(range.endDate));
    if (standalone) {
      onApply({ ...values, period }, status);
      return;
    }
    setDraft((d) => ({ ...d, period }));
    backToFilters('range');
  };

  const pickCounty = (county: { id: string; name: string } | null) => {
    const next = { ...(standalone ? values : draft), countyId: county?.id ?? null, countyName: county?.name ?? null };
    if (standalone) return onApply(next, status);
    setDraft(next);
    backToFilters('county');
  };

  // c13: the live count of the draft — the same search and scope, the draft's filters and state.
  // (Leaving «Ale mele» is what applying filters does, so the preview counts the public list then.)
  const previewScope = scope === 'registered' ? 'all' : scope;
  const previewParams = {
    scope: previewScope,
    status: draftStatus === 'all' ? undefined : draftStatus,
    search,
    filters: draft,
    sort: 'date' as const,
  };
  const preview = useInfiniteQuery({
    ...competitionCardsInfiniteQuery(t, previewParams, { isAuthenticated }),
    enabled: open && !standalone,
  });
  const previewTotal = selectCompetitionCards(preview.data, previewParams, { isAuthenticated }).total;
  // «Locuri libere» is filtered per page by the CMS while its total counts the unfiltered set
  // (competition-cards.ts, deliberate): no count is promised then (parity filters.c13 deviation).
  const applyLabel =
    preview.isSuccess && !preview.isPlaceholderData && !draft.availableOnly
      ? `Arată ${formatCount(previewTotal, 'concurs', 'concursuri')}`
      : 'Arată concursurile';

  const canReset = hasActiveFilters(draft);
  const back = view !== 'filters' && !standalone ? { label: 'Înapoi la filtre', onBack: () => backToFilters(view) } : undefined;
  const rangeLabel =
    range.startDate && range.endDate ? periodChipLabel(customPeriodValue(fromDayKey(range.startDate), fromDayKey(range.endDate)), now) : null;

  let footer: ReactNode = null;
  if (view === 'range') {
    footer = (
      <div className="flex items-center gap-3">
        <Button variant="outline" block className="flex-1" onClick={() => (standalone ? onClose() : backToFilters('range'))}>
          Renunță
        </Button>
        {/* The confirm echoes the choice once both ends are set («Aplică 8–14 oct.»). */}
        <Button block className="flex-[1.4]" disabled={!rangeLabel} onClick={confirmRange}>
          {rangeLabel ? `Aplică ${rangeLabel}` : 'Aplică'}
        </Button>
      </div>
    );
  } else if (!standalone && view === 'filters') {
    // The county view is a picker (a pick applies and returns): no «Resetează / Arată …» under it,
    // whose reset would disagree with the row still checked.
    footer = (
      <div className="flex items-center gap-4">
        <TextAction onClick={() => setDraft(DEFAULT_COMPETITION_FILTERS)} disabled={!canReset}>
          Resetează
        </TextAction>
        <div className="min-w-0 flex-1">
          <Button
            block
            aria-live="polite"
            onClick={() => {
              onApply(draft, draftStatus);
            }}
          >
            {applyLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ModalSurface open={open} onClose={onClose} title={HEADER_TITLE[view]} back={back} footer={footer}>
      {!open ? null : view === 'county' ? (
        <CountyView t={t} selectedId={(standalone ? values : draft).countyId} onPick={pickCounty} />
      ) : view === 'range' ? (
        <RangeView range={range} onChange={setRange} now={now} rangeLabel={rangeLabel} />
      ) : (
        <div className="flex flex-col gap-6 pt-4 pb-2">
          {/* c3: the state, as single-choice pills (draft until applied). */}
          <FilterSection title="Stare" icon={SECTION_ICON.status}>
            <ChoiceChips name="stare" options={STATUS_CHOICES} value={draftStatus} onChange={changeDraftStatus} />
          </FilterSection>

          {/* c5: free places only exist for a competition that has not started — on the committed
              Viitoare only; elsewhere the row is hidden and its stored value is kept. */}
          {status === 'notStarted' ? (
            <FilterSwitch
              label="Locuri libere"
              description="Doar concursurile care mai au locuri"
              checked={draft.availableOnly}
              onChange={(availableOnly) => setDraft((d) => ({ ...d, availableOnly }))}
            />
          ) : null}

          <FilterSection title="Perioadă" icon={SECTION_ICON.period}>
            {/* One sideways line on the phone (fish), fading at the edge that still scrolls; from 768
                the dialog has the room, so the presets wrap — nothing hidden behind a sideways scroll. */}
            {bp === 'mobile' ? (
              <div className="-mx-5 px-5 [mask-image:linear-gradient(to_right,black_calc(100%-(--spacing(6))),transparent)]">
                <ChoiceChips
                  name="perioada"
                  scroll
                  options={periodChoices(draft.period, draftStatus, now)}
                  value={draft.period}
                  onChange={(period) => setDraft((d) => ({ ...d, period }))}
                />
              </div>
            ) : (
              <ChoiceChips
                name="perioada"
                options={periodChoices(draft.period, draftStatus, now)}
                value={draft.period}
                onChange={(period) => setDraft((d) => ({ ...d, period }))}
              />
            )}
            <PickerRow
              id={rowId.range}
              label={customRange ? periodChipLabel(draft.period, now) : 'Alege din calendar'}
              accessibleLabel={customRange ? `Perioadă aleasă: ${periodChipLabel(draft.period, now)}` : 'Alege perioada din calendar'}
              active={Boolean(customRange)}
              leading={<CalendarDaysIcon />}
              onClick={openRange}
            />
          </FilterSection>

          <FilterSection title="Format" icon={SECTION_ICON.format}>
            <ChoiceChips name="format" options={FORMAT_CHOICES} value={draft.format} onChange={(format) => setDraft((d) => ({ ...d, format }))} />
          </FilterSection>

          <FilterSection title="Județ" icon={SECTION_ICON.county}>
            <PickerRow
              id={rowId.county}
              label={draft.countyName ?? (draft.countyId ? 'Județ selectat' : 'Toate județele')}
              accessibleLabel={`Județ: ${draft.countyName ?? 'toate județele'}`}
              active={Boolean(draft.countyId)}
              onClick={() => setView('county')}
            />
          </FilterSection>
        </div>
      )}
    </ModalSurface>
  );
}

/** fish PickerRow: a full-width row that opens a list or a picker; tinted when it holds a choice. */
export function PickerRow({
  id,
  label,
  accessibleLabel,
  active,
  leading,
  onClick,
  compact = false,
}: {
  id?: string;
  label: string;
  accessibleLabel: string;
  active: boolean;
  leading?: ReactNode;
  onClick: () => void;
  /** The popover rows' height (40, the list rows'). */
  compact?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-label={accessibleLabel}
      aria-haspopup="dialog"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-control text-left',
        // Compact: the geometry of the kit's ChoiceChips list rows above it (-mx-2, px-2, 40 high), so
        // the chevron and their checks share one right edge.
        compact ? '-mx-2 min-h-10 w-[calc(100%+var(--spacing)*4)] px-2 py-2 t-body' : 'min-h-12 w-full px-3.5 t-body-strong',
        'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
        active ? 'bg-accent-tint text-accent-ink' : compact ? 'text-ink-2 hover:bg-soft-fill hover:text-ink' : 'bg-soft-fill text-ink-2 hover:text-ink',
        active && !compact && RING_SELECTED,
        FOCUS_RING,
      )}
    >
      {leading ? (
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRightIcon aria-hidden className="size-4.5 shrink-0 text-muted" />
    </button>
  );
}

/**
 * The calendar sub-view: one line that says what to do, then what was chosen (t-body-strong ink
 * once a range is set), over the month. The header already says «Perioadă». On mount the line takes
 * focus, so the switch is announced and focus never falls to <body>.
 */
function RangeView({
  range,
  onChange,
  now,
  rangeLabel,
}: {
  range: DayRange;
  onChange: (range: DayRange) => void;
  now: Date;
  rangeLabel: string | null;
}) {
  const lineRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // After showModal() (an entry straight from a quick chip), which focuses the close X.
    const id = requestAnimationFrame(() => lineRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="flex flex-col gap-3 pt-4 pb-2">
      <p
        ref={lineRef}
        tabIndex={-1}
        aria-live="polite"
        data-range-line
        className={cn('outline-none', rangeLabel ? 't-body-strong text-ink' : 't-body text-ink-2')}
      >
        {rangeLabel ?? (range.startDate ? 'Acum alege ultima zi.' : 'Apasă prima zi, apoi ultima.')}
      </p>
      <RangeCalendar value={range} onChange={onChange} now={now} />
    </div>
  );
}

/**
 * c11 / c12: the county view — a contains search, «Toate județele», then the counties in Romanian
 * order, as the kit's single-choice rows (ChoiceChips list: radios, tint + check when chosen — the
 * docked column's look). A pointer pick (or Enter / Space on the focused row) applies and returns
 * to the filters; the arrow keys only move the choice, so walking the list never leaves the view.
 */
function CountyView({
  t,
  selectedId,
  onPick,
}: {
  t: Transport;
  selectedId: string | null;
  onPick: (county: { id: string; name: string } | null) => void;
}) {
  const inputId = useId();
  const [term, setTerm] = useState('');
  const q = useInfiniteQuery(lakesExploreSuggestionsInfiniteQuery(t, {}));
  const items = useMemo(() => flattenLakesExploreSuggestions(q.data), [q.data]);
  const complete = countyListComplete(items);
  const pages = q.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  // Page on until a city or a lake appears (every county is in), at most MAX_COUNTY_PAGES — and never
  // past a failed page (TanStack leaves hasNextPage true then: the effect would retry in a loop).
  const pageFailed = q.isFetchNextPageError;
  const paging =
    !complete && Boolean(hasNextPage) && pages > 0 && pages < MAX_COUNTY_PAGES && !pageFailed && !q.isError;
  useEffect(() => {
    if (!paging || isFetchingNextPage) return;
    void fetchNextPage();
  }, [paging, isFetchingNextPage, fetchNextPage]);

  const counties = useMemo(() => countyOptions(items), [items]);
  const shown = filterCounties(counties, term);
  // A county not on the first page is not «not found» while the later pages still load.
  const loading = (q.isPending || isFetchingNextPage || paging) && shown.length === 0;
  // The first page failed (nothing to show), or a later one did (a partial list: said under it).
  const failed = q.isError && !pageFailed && !loading && shown.length === 0;
  const partial = pageFailed && !loading;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The view's first control takes focus (after showModal() when the view is the entry).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const [choice, setChoice] = useState<string>(selectedId ?? 'all');
  const pointer = useRef(false);
  const commit = (value: string) => {
    if (value === 'all') return onPick(null);
    const county = counties.find((c) => c.id === value);
    if (county) onPick(county);
  };
  const options: Choice<string>[] = [{ value: 'all', label: 'Toate județele' }, ...shown.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="flex flex-col pt-4 pb-2">
      <div className="sticky top-0 z-above -mx-1 bg-surface px-1 pb-2">
        <label htmlFor={inputId} className="sr-only">
          Caută un județ
        </label>
        <div className={cn(SEARCH_SHELL, 'gap-2 pl-3')}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            id={inputId}
            // text, not search: Chromium's search field eats the first Escape to clear itself.
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Caută un județ"
            className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>
      <div
        className="px-2"
        onPointerDown={() => {
          pointer.current = true;
        }}
        onClick={(e) => {
          // A pointer pick — also of the row already chosen, which fires no change.
          const input = (e.target as HTMLElement).closest('label')?.querySelector('input');
          if (!input || !pointer.current) return;
          pointer.current = false;
          commit(input.value);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          commit(choice);
        }}
      >
        <ChoiceChips name="judet" layout="list" label="Județe" options={options} value={choice} onChange={setChoice} />
      </div>
      {loading ? (
        <p role="status" className="py-4.5 t-body text-muted">
          Se încarcă județele…
        </p>
      ) : failed ? (
        <div role="status" className="flex flex-col items-start gap-1 py-4.5">
          <p className="t-body text-ink-2">Județele nu s-au încărcat.</p>
          <TextAction onClick={() => void q.refetch()}>Încearcă din nou</TextAction>
        </div>
      ) : partial ? (
        // Some counties are missing: never «Niciun județ găsit» for one that did not load.
        <div role="status" className="flex flex-col items-start gap-1 py-4.5">
          <p className="t-body text-ink-2">Unele județe nu s-au încărcat.</p>
          <TextAction onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Se încarcă…' : 'Încearcă din nou'}
          </TextAction>
        </div>
      ) : shown.length === 0 ? (
        <p role="status" className="py-4.5 t-body text-muted">
          Niciun județ găsit.
        </p>
      ) : null}
    </div>
  );
}
