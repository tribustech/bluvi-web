'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ExclamationTriangleIcon, NoSymbolIcon, PhoneIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import {
  selectDaySelection,
  selectionFromState,
  toggleSelectionCell,
  type BlockInfo,
  type DayHeader as Day,
  type GridSelectionState,
} from '@/core/booking';
import { useBack } from '@/components/nav/useBack';
import { T4Gate, T4Spinner } from '@/components/templates/T4';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { nextStepFromGrid, offeredForSelection, seedSelection, selectionStand } from '../_flow/guards';
import { useFlowQuote, useLiveAvailability } from '../_flow/hooks';
import { flowQuery, readFlowParams, stepHref, type FlowSelection } from '../_flow/params';
import { AvailabilityGrid, type GridHandle } from './AvailabilityGrid';
import { BlockDialog } from './BlockDialog';
import { BookingFrame } from './BookingFrame';
import { GridSkeleton } from './GridSkeleton';
import { Legend, TodayButton } from './Legend';
import { buildGridModel, dayIndexOf, dayRefusal, runAction, selectionFree, selectionLabelOf, zoneHint, type GridRun } from './model';
import { SelectionPanel } from './SelectionPanel';
import { TooSoonDialog } from './TooSoonDialog';

/*
 * Step 1 of the angler's booking flow — fish app/(app)/book-lake/[lakeId]/index.tsx +
 * BookingGridStep + useBookingGridFlow + BookingSelectionSheetHost (parity booking.rezerva-grila).
 *
 * The selection is the flow's state and lives in the URL (_flow/params.ts, c24): written with the
 * History API, which Next's router follows (useSearchParams) without a server round trip — a
 * router.replace would re-run the page's session gate on every tap. The first selection PUSHES an
 * entry and later changes replace it, so Back (the browser's, or the header's) first clears the
 * selection and only the next Back leaves the flow (fish usePreventRemove → clearSelection, c37).
 * The pushed entry carries a mark in its history state (SEL_MARK), so a later mount on it — Back from
 * the extras / review step, a reload — still knows the bare grid lies under it and steps back onto it.
 */

/** History-state mark of the entry the first selection pushed (Next's pushState patch adds its own fields). */
const SEL_MARK = 'rezervaSel';
const onPushedEntry = () => !!(window.history.state as Record<string, unknown> | null)?.[SEL_MARK];

export type GridLake = {
  documentId: string;
  name: string;
  /** The lake's first contact phone (fish `lake.contact[0].phone`), for the too-soon call. */
  phone: string | null;
  paymentMode: string | null;
  depositPercent: number | null;
  checkoutBufferMinutes: number | null;
};

function useMedia(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** How far ahead a seeded selection may make the grid read (months), looking for its slots. */
const SEED_MONTHS_MAX = 12;

export function BookingGridScreen({ lake }: { lake: GridLake }) {
  const lakeId = lake.documentId;
  const router = useRouter();
  const toast = useSiteToast();
  const leave = useBack(routes.lake(lakeId));
  /** From 1024 the panel is the right summary card and the header stays (owner rule 1). */
  const desktop = useMedia('(min-width: 1024px)');
  /** From 768 the time axis is drawn 1.5× wider (model.ts scaleGeometry). */
  const wide = useMedia('(min-width: 768px)');
  const search = useSearchParams();
  const [initial] = useState(() => readFlowParams(new URLSearchParams(search.toString())));

  const { query, merged, checkoutBufferMinutes } = useLiveAvailability(lakeId);
  // «Now» moves with every fresh read (refetch on focus / mount, a new month page): a tab left open
  // overnight re-judges past (c14) and lead-time (c15) cells against the time the slots were read.
  const [mountMs] = useState(() => Date.now());
  const nowMs = Math.max(mountMs, query.dataUpdatedAt);
  const model = useMemo(() => (merged ? buildGridModel(merged, nowMs, wide ? 1.5 : 1) : null), [merged, nowMs, wide]);

  // ── The selection (the URL's, then the grid's) ─────────────────────────────────────────────
  const [sel, setSel] = useState<FlowSelection | null>(initial.selection);
  const state = useMemo(() => (model ? seedSelection(sel, model.slots) : null), [model, sel]);
  /** The selection that is on the grid (a URL selection the slots do not have yet is not). */
  const live = state ? sel : null;
  const pushed = useRef(false);

  const write = useCallback((next: FlowSelection | null, mode: 'push' | 'replace') => {
    setSel(next);
    const q = flowQuery(next);
    const url = `${window.location.pathname}${q ? `?${q}` : ''}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (mode === 'push') {
      // Plain data, never a copy of history.state: with Next's __NA in it, the patched pushState
      // would skip syncing useSearchParams. The patch copies its own fields in.
      window.history.pushState({ [SEL_MARK]: 1 }, '', url);
      pushed.current = true;
    } else window.history.replaceState(next && onPushedEntry() ? { [SEL_MARK]: 1 } : null, '', url);
  }, []);

  const clearSelection = useCallback(() => {
    if (pushed.current) {
      // The entry under this one is the grid without a selection: step back onto it.
      pushed.current = false;
      setSel(null);
      window.history.back();
    } else write(null, 'replace');
  }, [write]);

  // A mount on the selection's own entry (Back from a later step, a reload): the bare grid is under it.
  useEffect(() => {
    pushed.current = onPushedEntry();
  }, []);

  // Back / Forward between the selection's entry and the bare grid's.
  useEffect(() => {
    const onPop = () => {
      pushed.current = onPushedEntry();
      setSel(readFlowParams(new URLSearchParams(window.location.search)).selection);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Judge the URL's selection once the slots are there: keep it, read ahead (up to a year) for a
  // selection further out, or drop it — a stand the lake no longer has, an interval that is not a run
  // of slots, or one that is no longer free (taken, started, inside the lead time). Decided once, during
  // render (React's «adjust state while rendering»); the URL follows in an effect.
  const [verdict, setVerdict] = useState<'pending' | 'kept' | 'dropped'>(initial.selection ? 'pending' : 'kept');
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const pageCount = query.data?.pages.length ?? 0;
  const readAhead =
    verdict === 'pending' &&
    !!sel &&
    !!merged &&
    !state &&
    Date.parse(sel.start) >= Date.parse(merged.loadedRange.to) &&
    hasNextPage &&
    pageCount <= SEED_MONTHS_MAX;
  if (verdict === 'pending' && model && merged && sel && !readAhead) {
    const ok = !!selectionStand(merged, sel) && selectionFree(model, state);
    setVerdict(ok ? 'kept' : 'dropped');
    if (!ok) setSel(null);
  }
  useEffect(() => {
    if (readAhead && !isFetchingNextPage) void fetchNextPage();
  }, [readAhead, isFetchingNextPage, fetchNextPage]);
  // The URL after the verdict: the kept selection without a later step's extras (the grid quotes the
  // bare tour), or none.
  useEffect(() => {
    if (verdict === 'pending') return;
    if (verdict === 'kept' && !initial.extras.length) return;
    const q = flowQuery(verdict === 'kept' ? initial.selection : null);
    const mark = verdict === 'kept' && onPushedEntry() ? { [SEL_MARK]: 1 } : null;
    window.history.replaceState(mark, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [verdict, initial]);

  // Every fresh read re-judges the selection on the grid (the seed verdict's check): taken by someone
  // else, started, or now inside the lead time → cleared and said, never left as a stale pill.
  useEffect(() => {
    if (verdict !== 'kept' || !model || !sel || selectionFree(model, state)) return;
    clearSelection();
    toast('Intervalul ales nu mai e liber.', 'danger');
  }, [verdict, model, sel, state, clearSelection, toast]);

  const applyState = useCallback(
    (next: GridSelectionState | null) => {
      if (!model) return;
      const s = selectionFromState(next, model.slots);
      if (!s) return clearSelection();
      write({ stand: s.standDocumentId, start: s.startISO, end: s.endISO }, live ? 'replace' : 'push');
    },
    [model, live, write, clearSelection]
  );

  // ── Taps ──────────────────────────────────────────────────────────────────────────────────
  const [tooSoon, setTooSoon] = useState(false);
  const [block, setBlock] = useState<BlockInfo | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);

  const onBandPress = useCallback(
    (standId: string, run: GridRun) => {
      if (!model) return;
      switch (runAction(run)) {
        case 'toggle': {
          const next = toggleSelectionCell(state, standId, run.cellIndex, model.isAvailable);
          if (next !== state) applyState(next);
          return;
        }
        case 'too-soon':
          setTooSoon(true);
          return;
        case 'past':
          toast('Interval trecut — alege o zi viitoare.', 'danger');
          return;
        case 'block':
          // The block travels with the band, so the panel describes the slot actually tapped.
          setBlock(run.block);
          setBlockOpen(true);
          return;
        default:
        // Booked / a plain block: someone else's slot has nothing to say (c18).
      }
    },
    [model, state, applyState, toast]
  );

  const onDayPress = useCallback(
    (day: Day) => {
      if (!model) return;
      if (!state) {
        toast('Selectează mai întâi un stand.', 'danger');
        return;
      }
      const next = selectDaySelection(state.standDocumentId, day.date, model.slots, model.isAvailable);
      if (next) applyState(next);
      else toast(dayRefusal(model, day), 'danger');
    },
    [model, state, applyState, toast]
  );

  const onReachEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── The panel's quote and its way on ───────────────────────────────────────────────────────
  const quoteQ = useFlowQuote(lakeId, live);
  const stand = selectionStand(merged, live);
  const offered = useMemo(() => offeredForSelection(merged, live), [merged, live]);
  const onContinue = useCallback(() => {
    if (!live) return;
    // Extras always start empty (the panel quoted the bare tour, c35).
    router.push(stepHref(lakeId, nextStepFromGrid(merged, live), { selection: live, extras: [] }));
  }, [live, merged, router, lakeId]);

  const gridRef = useRef<GridHandle>(null);
  const back = {
    label: live ? 'Anulează selecția' : 'Înapoi',
    onClick: () => (live ? clearSelection() : leave()),
  };
  const title = lake.name || 'Rezervare';
  const buffer = checkoutBufferMinutes ?? lake.checkoutBufferMinutes ?? 0;

  // ── States ────────────────────────────────────────────────────────────────────────────────
  if (!merged || !model) {
    if (query.isError) {
      // No availability to fall back on AND the read failed (c27): a retry, never a spinner forever.
      return (
        <BookingFrame title={title} back={back}>
          <T4Gate
            tone="danger"
            role="alert"
            icon={<ExclamationTriangleIcon />}
            title="A apărut o eroare la încărcarea disponibilității."
            actions={
              <button
                type="button"
                data-testid="availability-retry"
                aria-disabled={query.isFetching || undefined}
                onClick={query.isFetching ? undefined : () => void query.refetch()}
                className={buttonClass({ disabled: query.isFetching })}
              >
                {query.isFetching ? <T4Spinner /> : null}
                {query.isFetching ? 'Se reîncarcă…' : 'Încearcă din nou'}
              </button>
            }
          />
        </BookingFrame>
      );
    }
    return (
      <BookingFrame title={title} back={back} busy legend={<Legend />}>
        <GridSkeleton />
      </BookingFrame>
    );
  }

  if (!merged.bookingEnabled) {
    return (
      <BookingFrame title={title} back={back}>
        <T4Gate
          icon={<NoSymbolIcon />}
          title="Rezervările nu sunt disponibile"
          description="Acest lac nu acceptă deocamdată rezervări online."
          actions={
            <>
              {lake.phone ? (
                <ButtonLink href={`tel:${lake.phone}`} icon={<PhoneIcon />}>
                  Sună la baltă
                </ButtonLink>
              ) : null}
              <ButtonLink href={routes.lake(lakeId)} variant={lake.phone ? 'secondary' : 'primary'}>
                Înapoi la baltă
              </ButtonLink>
            </>
          }
        />
      </BookingFrame>
    );
  }

  if (!merged.stands.length || !model.geometry.days.length || !model.geometry.bands.length) {
    return (
      <BookingFrame title={title} back={back}>
        <T4Gate
          icon={<CalendarDaysIcon />}
          title="Nicio disponibilitate"
          description="Nu există standuri sau intervale disponibile pentru această perioadă."
          actions={<ButtonLink href={routes.lake(lakeId)}>Înapoi la baltă</ButtonLink>}
        />
      </BookingFrame>
    );
  }

  const hint = zoneHint(merged.timezone, nowMs);
  const openOnDay = live ? dayIndexOf(model, live.start) : sel ? dayIndexOf(model, sel.start) : model.todayDayIndex;
  const panel = (variant: 'sheet' | 'card') =>
    live && stand ? (
      <SelectionPanel
        variant={variant}
        headingId={`selection-${variant}`}
        standName={stand.name}
        startISO={live.start}
        endISO={live.end}
        checkoutBufferMinutes={buffer}
        paymentMode={lake.paymentMode}
        depositPercent={lake.depositPercent}
        offeredCount={offered.length}
        price={{
          quote: quoteQ.data ?? null,
          quoting: quoteQ.isFetching,
          failed: quoteQ.isError,
          onRetry: () => void quoteQ.refetch(),
        }}
        onCancel={clearSelection}
        onContinue={onContinue}
      />
    ) : null;

  return (
    <>
      <BookingFrame
        title={title}
        back={back}
        collapsed={!!live && !desktop}
        trailing={<TodayButton onClick={() => gridRef.current?.scrollToToday()} />}
        legend={
          <>
            <Legend />
            {hint ? (
              <p data-testid="zone-hint" className="t-caption mt-1.5 text-muted">
                {hint}
              </p>
            ) : null}
          </>
        }
        aside={
          desktop ? (
            <section
              aria-label="Selecția ta"
              data-testid="selection-card"
              className="flex flex-col rounded-card bg-surface p-5 shadow-[var(--shadow-e1),var(--shadow-e0)] xl:p-6"
            >
              {live ? (
                panel('card')
              ) : (
                <div className="flex flex-col gap-2" data-testid="selection-empty">
                  <p className="t-eyebrow text-muted uppercase">Selecția ta</p>
                  <p className="t-heading text-ink">Alege un interval liber</p>
                  <p className="t-body text-muted">
                    Atinge un interval alb pe rândul standului dorit, apoi altul pe același rând ca să prelungești. Atinge o zi ca să iei toată ziua.
                  </p>
                </div>
              )}
            </section>
          ) : undefined
        }
        dock={
          !desktop && live ? (
            <section
              aria-label="Selecția ta"
              data-testid="selection-panel"
              className="shrink-0 border-t border-hairline bg-surface px-4 pt-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))] shadow-tabbar md:px-6"
            >
              {panel('sheet')}
            </section>
          ) : undefined
        }
      >
        <AvailabilityGrid
          handle={gridRef}
          model={model}
          stands={merged.stands}
          state={state}
          selectionLabel={selectionLabelOf(model, state)}
          openOnDay={openOnDay}
          fetchingNext={query.isFetchingNextPage}
          onReachEnd={onReachEnd}
          onBandPress={onBandPress}
          onDayPress={onDayPress}
        />
      </BookingFrame>
      <TooSoonDialog
        open={tooSoon}
        onClose={() => setTooSoon(false)}
        leadHours={merged.leadHours}
        phone={lake.phone}
        lakeId={lakeId}
        lakeName={lake.name}
      />
      <BlockDialog open={blockOpen} block={block} onClose={() => setBlockOpen(false)} />
    </>
  );
}
