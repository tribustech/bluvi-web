'use client';

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { ChevronRightIcon, HomeModernIcon } from '@heroicons/react/24/outline';
import type { AvailabilityStand, DayHeader as Day, GridSelectionState } from '@/core/booking';
import { cn } from '@/components/ui/cn';
import { DayHeader } from './DayHeader';
import { GridBand } from './GridBand';
import { CELL_H, HEADER_H, PINNED_W, selectionRightPx, standRuns, type GridModel, type GridRun } from './model';

/*
 * The availability grid — fish AvailabilityGrid.tsx on the web.
 *
 * Rows are stands (frozen left column «Stand»: the name, and a cabin mark when the stand has extras),
 * columns are days on a proportional time axis (c10). ONE element scrolls both axes: the day header
 * is its sticky first row, the stand names its sticky first column, so header, names and bands can
 * never drift apart (fish needed a nested pair of scrollers and a transform for the same). The grid
 * takes the full width of its column (ROADMAP §4: booking tables use all the width).
 *
 * - opens on today, or on the seeded selection's day (c24); «Azi» scrolls back to today (c3);
 * - within 2 day columns of the loaded end it asks for the next month, once per approach (re-armed
 *   when scrolled back), and draws the incoming month as a dimmed column with a spinner (c9);
 * - a right-edge fade says the grid continues; when the selection's right edge is out of view a
 *   chevron caps that edge (c23);
 * - a new selection centres its stand's row in the visible rows (c22);
 * - keyboard: one roving tab stop for the bands (arrows move within a row and between rows, Home /
 *   End to a row's ends), another for the day pills; Enter / Space press.
 */

export type GridHandle = { scrollToToday: () => void };

type Props = {
  model: GridModel;
  stands: AvailabilityStand[];
  state: GridSelectionState | null;
  selectionLabel: string | null;
  /** Day column the grid opens on (today, or the seeded selection's day). */
  openOnDay: number;
  fetchingNext: boolean;
  onReachEnd: () => void;
  onBandPress: (standId: string, run: GridRun) => void;
  onDayPress: (day: Day) => void;
  handle?: Ref<GridHandle>;
};

export function AvailabilityGrid({
  model,
  stands,
  state,
  selectionLabel,
  openOnDay,
  fetchingNext,
  onReachEnd,
  onBandPress,
  onDayPress,
  handle,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const { dayWidthPx, bodyWidthPx, days, headerSlots } = model.geometry;
  const width = PINNED_W + bodyWidthPx + (fetchingNext ? dayWidthPx : 0);

  // ── Roving focus: the band that is in the tab order ────────────────────────────────────────
  const [active, setActive] = useState<{ stand: string; cell: number } | null>(null);
  const rows = useMemo(
    () => stands.map(s => ({ stand: s, runs: standRuns(model, s, state, selectionLabel) })),
    [stands, model, state, selectionLabel]
  );
  const tabStop = useMemo(() => {
    const has = (r: (typeof rows)[number], cell: number) => r.runs.find(x => cell >= x.firstCell && cell <= x.lastCell);
    if (active) {
      const row = rows.find(r => r.stand.documentId === active.stand);
      const run = row && has(row, active.cell);
      if (row && run) return { stand: row.stand.documentId, run };
    }
    if (state) {
      const row = rows.find(r => r.stand.documentId === state.standDocumentId);
      const run = row && has(row, state.startIndex);
      if (row && run) return { stand: row.stand.documentId, run };
    }
    // First future band of the first row, so Tab lands where the choice is.
    const row = rows[0];
    const run = row?.runs.find(r => !r.isPast) ?? row?.runs[0];
    return row && run ? { stand: row.stand.documentId, run } : null;
  }, [rows, active, state]);

  // A tap re-keys the run it lands on (a free cell becomes the selected pill): give the focus back to
  // whatever band now covers that cell, so the keyboard keeps its place.
  const refocus = useRef<{ stand: string; cell: number } | null>(null);
  const press = useCallback(
    (standId: string, run: GridRun) => {
      const el = scroller.current;
      const focused = !!el && el.contains(document.activeElement);
      setActive({ stand: standId, cell: run.firstCell });
      if (focused) refocus.current = { stand: standId, cell: run.firstCell };
      onBandPress(standId, run);
    },
    [onBandPress]
  );
  useLayoutEffect(() => {
    const target = refocus.current;
    const el = scroller.current;
    if (!target || !el) return;
    refocus.current = null;
    if (document.activeElement && el.contains(document.activeElement) && document.activeElement !== document.body) {
      const a = document.activeElement as HTMLElement;
      if (a.isConnected && a.dataset.stand === target.stand) return;
    }
    const btn = [...el.querySelectorAll<HTMLButtonElement>(`button[data-band][data-stand="${CSS.escape(target.stand)}"]`)].find(
      b => Number(b.dataset.first) <= target.cell && target.cell <= Number(b.dataset.last)
    );
    btn?.focus({ preventScroll: true });
  });

  const onRowsKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!t.matches('button[data-band]')) return;
    const row = t.closest<HTMLElement>('[data-row]');
    if (!row) return;
    const inRow = [...row.querySelectorAll<HTMLButtonElement>('button[data-band]')];
    const i = inRow.indexOf(t as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowRight') next = inRow[i + 1];
    else if (e.key === 'ArrowLeft') next = inRow[i - 1];
    else if (e.key === 'Home') next = inRow[0];
    else if (e.key === 'End') next = inRow[inRow.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const other = (e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling) as HTMLElement | null;
      if (other?.matches('[data-row]')) {
        const x = t.offsetLeft + t.offsetWidth / 2;
        const cands = [...other.querySelectorAll<HTMLButtonElement>('button[data-band]')];
        next =
          cands.find(b => b.offsetLeft <= x && x <= b.offsetLeft + b.offsetWidth) ??
          cands.reduce<HTMLButtonElement | undefined>(
            (best, b) =>
              !best || Math.abs(b.offsetLeft + b.offsetWidth / 2 - x) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - x) ? b : best,
            undefined
          );
      }
    } else return;
    e.preventDefault();
    if (!next) return;
    setActive({ stand: next.dataset.stand!, cell: Number(next.dataset.first) });
    next.focus();
  }, []);

  // ── Horizontal: open on the day, the next month near the end, the selection's edge chevron ──
  // Snapped (unanimated) until the user touches the grid: a seeded selection further out lands on
  // its day once the months up to it have loaded (fish re-snaps from onContentSizeChange the same way).
  const touched = useRef(false);
  const touch = useCallback(() => {
    touched.current = true;
  }, []);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || touched.current || dayWidthPx <= 0) return;
    el.scrollLeft = openOnDay * dayWidthPx;
  }, [openOnDay, dayWidthPx, bodyWidthPx]);

  const armed = useRef(true);
  const selRight = selectionRightPx(model, state);
  const [chevron, setChevron] = useState(false);
  const check = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const viewport = el.clientWidth - PINNED_W;
    const x = el.scrollLeft;
    const nearEnd = x + viewport >= bodyWidthPx - dayWidthPx * 2;
    if (nearEnd && armed.current) {
      armed.current = false;
      onReachEnd();
    } else if (!nearEnd) armed.current = true;
    const show = selRight >= 0 && selRight > x + viewport;
    setChevron(prev => (prev === show ? prev : show));
  }, [bodyWidthPx, dayWidthPx, onReachEnd, selRight]);
  // New geometry (a month landed) or a new selection: re-check without waiting for a scroll.
  useEffect(() => {
    check();
  }, [check]);

  // ── Vertical: centre the newly selected stand's row in the visible rows (c22) ────────────────
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight);
      check();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);
  const selectedStand = state?.standDocumentId ?? null;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !selectedStand || !height) return;
    const i = stands.findIndex(s => s.documentId === selectedStand);
    if (i < 0) return;
    const top = Math.max(0, i * CELL_H + CELL_H / 2 - (height - HEADER_H) / 2);
    el.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selectedStand, height, stands]);

  useImperativeHandle(
    handle,
    () => ({
      scrollToToday: () => {
        touched.current = true;
        scroller.current?.scrollTo({
          left: model.todayDayIndex * dayWidthPx,
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      },
    }),
    [model.todayDayIndex, dayWidthPx]
  );

  const todayPill = days.some(d => d.dayIndex === model.todayDayIndex) ? model.todayDayIndex : (days[0]?.dayIndex ?? 0);

  return (
    <div
      role="region"
      aria-label="Disponibilitate pe standuri și zile"
      data-testid="availability-grid"
      className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-hairline bg-surface"
    >
      <div ref={scroller} onScroll={check} onPointerDown={touch} onWheel={touch} onKeyDown={touch} onTouchStart={touch} className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-width:thin]">
        <div className="relative" style={{ width }}>
          <DayHeader
            days={days}
            labels={model.dayLabels}
            headerSlots={headerSlots}
            dayWidthPx={dayWidthPx}
            bodyWidthPx={bodyWidthPx}
            fetchingNext={fetchingNext}
            tabDayIndex={todayPill}
            onDayPress={onDayPress}
          />
          <div onKeyDown={onRowsKeyDown}>
            {rows.map(({ stand, runs }) => (
              <StandRow
                key={stand.documentId}
                stand={stand}
                runs={runs}
                bodyWidthPx={bodyWidthPx}
                tabRun={tabStop?.stand === stand.documentId ? tabStop.run : null}
                onPress={press}
              />
            ))}
          </div>
          {fetchingNext ? (
            // One placeholder column for the month being read (fish: not one per row).
            <div
              aria-hidden
              data-testid="grid-next-placeholder"
              className="absolute bottom-0 bg-soft-fill opacity-60"
              style={{ left: PINNED_W + bodyWidthPx, width: dayWidthPx, top: HEADER_H }}
            />
          ) : null}
        </div>
      </div>
      {/* The grid continues past the viewport: a fade on the right edge says so (c23). */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 w-7 bg-linear-to-r from-transparent to-surface"
        style={{ top: HEADER_H }}
      />
      {/* The selection runs off the right edge: a chevron caps it. */}
      <div
        aria-hidden
        data-testid="grid-edge-hint"
        data-visible={chevron || undefined}
        className={cn(
          'pointer-events-none absolute right-0 bottom-0 flex w-7 items-center justify-center bg-surface/85 text-accent',
          'transition-opacity duration-(--duration-fast) ease-fast',
          chevron ? 'opacity-100' : 'opacity-0',
        )}
        style={{ top: HEADER_H }}
      >
        <ChevronRightIcon className="size-4" />
      </div>
    </div>
  );
}

const StandRow = memo(function StandRow({
  stand,
  runs,
  bodyWidthPx,
  tabRun,
  onPress,
}: {
  stand: AvailabilityStand;
  runs: GridRun[];
  bodyWidthPx: number;
  tabRun: GridRun | null;
  onPress: (standId: string, run: GridRun) => void;
}) {
  const hasExtras = stand.extras.length > 0;
  return (
    <div role="group" aria-label={`Stand ${stand.name}${hasExtras ? ', cu cabană' : ''}`} data-row={stand.documentId} className="flex" style={{ height: CELL_H }}>
      <div
        aria-hidden
        className="sticky left-0 z-above flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-b border-hairline bg-surface px-1.5"
        style={{ width: PINNED_W }}
      >
        <span className="t-body max-w-full truncate text-ink">{stand.name}</span>
        {hasExtras ? <HomeModernIcon data-testid="stand-extras-mark" className="size-3 shrink-0 text-status-success-fg" /> : null}
      </div>
      <div className="relative shrink-0 border-b border-hairline" style={{ width: bodyWidthPx }}>
        {runs.map(run => (
          <GridBand key={`${run.key}-${run.leftPx}`} run={run} standId={stand.documentId} tabbable={tabRun === run} onPress={onPress} />
        ))}
      </div>
    </div>
  );
});
