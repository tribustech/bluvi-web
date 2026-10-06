'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
// Fundații §05: UI actions are 24 outline glyphs; the chevron is the disclosure mark of a chip.
import { AdjustmentsHorizontalIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { TextAction } from './ColumnCard';
import { ChoiceChips, type Choice } from './Filters';
import { filterChipClass } from './toolbarStyles';

/*
 * T1 «Filtre» as a horizontal bar above the results (owner rule 2, ROADMAP §4b 2026-10-06: list
 * pages never give a column to a vertical filter sidebar). One row:
 *
 *   [Filtre · N]  │  quick chips …………………………………  Resetează
 *
 *  - «Filtre» opens the page's whole filter surface (FiltersSurface / the page's own dialog: a
 *    Dialog from 768, a Sheet on the phone). Its badge counts every active filter, quick or not.
 *  - Quick chips are the most used filters, each in one tap: FilterChipToggle (yes/no), FilterChipMenu
 *    (one choice from a short list, in a popover under the chip — applies as it is picked, like the
 *    old docked column did) and FilterChipButton (opens a picker dialog: a county, a calendar).
 *    A chip holding a choice shows the choice («Weekendul acesta»), tinted, never the question.
 *  - «Resetează» appears once anything is chosen.
 *
 * Phone: one line — «Filtre» pinned at the start, the chips scroll sideways (fading at the edge that
 * still scrolls), «Resetează» pinned at the end. From 768 the chips wrap. The freed column goes to
 * the results: ListPage without `filters` gives the centre the left track's width.
 */
export function FilterBar({
  label = 'Filtre',
  count = 0,
  onOpenFilters,
  expanded,
  controls,
  onReset,
  canReset,
  end,
  children,
  className,
  filtersClassName,
  resetLabel = 'Resetează',
}: {
  /** Accessible name of the bar («Filtre concursuri»). */
  label?: string;
  /** Active filters, quick or in the dialog (the «Filtre» badge). */
  count?: number;
  /** Opens every filter (omit when the page has nothing beyond the chips). */
  onOpenFilters?: () => void;
  expanded?: boolean;
  controls?: string;
  onReset?: () => void;
  canReset?: boolean;
  /** At the far end (a sort, a view toggle). */
  end?: ReactNode;
  /** The quick chips. */
  children?: ReactNode;
  className?: string;
  /**
   * On the «Filtre» chip and its divider: a page whose phone toolbar has its own «Filtre» square
   * (T2's floating toolbar) hides the bar's one there (`max-md:hidden`).
   */
  filtersClassName?: string;
  /** The reset action's label (the same place at the end of the row). */
  resetLabel?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const row = scroller.current;
    if (!row) return;
    const check = () => {
      const start = row.scrollLeft > 1;
      const endEdge = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      setEdges((e) => (e.start === start && e.end === endEdge ? e : { start, end: endEdge }));
    };
    check();
    row.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(row);
    return () => {
      row.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);
  const active = count > 0;
  return (
    <div role="group" aria-label={label} className={cn('flex min-w-0 items-center gap-2', className)}>
      {onOpenFilters ? (
        <>
          <button
            type="button"
            onClick={onOpenFilters}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-controls={controls}
            aria-label={active ? `Filtre, ${count} active` : 'Filtre'}
            className={cn(filterChipClass({ active }), 'relative', filtersClassName)}
          >
            <AdjustmentsHorizontalIcon aria-hidden className="size-4.5" />
            Filtre
            {/* On the chip's corner, not in its flow: a filter turning on never widens «Filtre», so
                the chips after it never move under the pointer. */}
            {active ? (
              <span
                aria-hidden
                className="t-micro-strong absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent-ink px-1 text-on-accent tabular-nums ring-2 ring-page"
              >
                {count}
              </span>
            ) : null}
          </button>
          {children ? <span aria-hidden className={cn('h-6 w-px shrink-0 bg-shimmer', filtersClassName)} /> : null}
        </>
      ) : null}
      <div
        ref={scroller}
        className={cn(
          // -my/py: room for the chips' focus rings and selected rings inside the scroller's clip.
          '-my-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'md:flex-wrap md:overflow-visible',
          // Phone: with nothing pinned after it, the line runs to the screen edge (under the gutter).
          !(onReset && canReset) && !end && 'max-md:-mr-4 max-md:pr-4',
          edges.start && edges.end
            ? 'max-md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(6),black_calc(100%-(--spacing(6))),transparent)]'
            : edges.end
              ? 'max-md:[mask-image:linear-gradient(to_right,black_calc(100%-(--spacing(6))),transparent)]'
              : edges.start
                ? 'max-md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(6))]'
                : null,
        )}
      >
        {children}
      </div>
      {onReset && canReset ? (
        <TextAction onClick={onReset} className="mr-0">
          {resetLabel}
        </TextAction>
      ) : null}
      {end ? <div className="flex shrink-0 items-center gap-2">{end}</div> : null}
    </div>
  );
}

/** A yes/no quick filter («Locuri libere», «Rezervabil»): a pressed pill. */
export function FilterChipToggle({
  label,
  pressed,
  onChange,
  leading,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  leading?: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onChange(!pressed)} className={filterChipClass({ active: pressed })}>
      {leading ? (
        <span aria-hidden className="flex items-center [&>svg]:size-4.5">
          {leading}
        </span>
      ) : null}
      {label}
    </button>
  );
}

/**
 * A quick filter that opens a picker (a dialog: the county list, the calendar, a lakes section).
 * Shows the choice when there is one (`value`), else the question (`label`).
 */
export function FilterChipButton({
  label,
  value,
  onClick,
  expanded,
  leading,
}: {
  label: string;
  /** The current choice («Ilfov»); null / undefined when nothing is chosen. */
  value?: string | null;
  onClick: () => void;
  expanded?: boolean;
  leading?: ReactNode;
}) {
  const active = Boolean(value);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={active ? `${label}: ${value}` : label}
      className={filterChipClass({ active })}
    >
      {leading ? (
        <span aria-hidden className="flex items-center [&>svg]:size-4.5">
          {leading}
        </span>
      ) : null}
      <span className="max-w-48 truncate">{value || label}</span>
      <ChevronDownIcon aria-hidden className="size-4 shrink-0" />
    </button>
  );
}

/**
 * One choice from a short list, in a popover under the chip (native `popover`: top layer, light
 * dismiss, Escape, focus back to the chip). The choice applies as it is made — a pointer pick (or
 * Enter) also closes the popover; the arrow keys only move the choice, so walking the list never
 * closes it. `after` renders under the list (a «Alege din calendar» row), given `close`.
 */
export function FilterChipMenu<V extends string>({
  label,
  name,
  options,
  value,
  onChange,
  defaultValue,
  chosenLabel,
  after,
}: {
  /** The question («Perioadă»): the chip's label while nothing is chosen, the popover's name. */
  label: string;
  name: string;
  options: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The «nothing chosen» value («all»): the chip shows the question, untinted, on it. */
  defaultValue: V;
  /** A choice the list does not hold (a custom calendar range): the chip shows it, tinted. */
  chosenLabel?: string | null;
  after?: (close: () => void) => ReactNode;
}) {
  const uid = useId();
  const popId = `${uid}-pop`;
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pointer = useRef(false);

  const place = useCallback(() => {
    const b = button.current;
    const p = pop.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const width = p.offsetWidth;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    p.style.left = `${Math.round(left)}px`;
    // Under the chip; above it when the window has no room below (a chip low on the screen).
    const below = r.bottom + 8;
    const above = r.top - 8 - p.offsetHeight;
    const flip = below + p.offsetHeight > window.innerHeight - 8 && above >= 8;
    p.style.top = `${Math.round(flip ? above : below)}px`;
  }, []);

  useEffect(() => {
    const p = pop.current;
    if (!p) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (!isOpen) return;
      place();
      (p.querySelector<HTMLElement>('input:checked') ?? p.querySelector<HTMLElement>('input, button'))?.focus();
    };
    // beforetoggle: placed before the first paint of the open popover (no jump from the corner).
    const onBefore = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') place();
    };
    p.addEventListener('beforetoggle', onBefore);
    p.addEventListener('toggle', onToggle);
    return () => {
      p.removeEventListener('beforetoggle', onBefore);
      p.removeEventListener('toggle', onToggle);
    };
  }, [place]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // By id, not the ref: `after(close)` is called during render (react-hooks/refs).
  const close = useCallback(() => {
    const p = document.getElementById(popId);
    if (p?.matches(':popover-open')) p.hidePopover();
  }, [popId]);

  const chosen = value !== defaultValue ? options.find((o) => o.value === value) : undefined;
  const shown = chosenLabel || (chosen ? (chosen.detail ? `${chosen.label} · ${chosen.detail}` : chosen.label) : null);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={popId}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={shown ? `${label}: ${shown}` : label}
        className={filterChipClass({ active: Boolean(shown) })}
      >
        {chosen?.leading && !chosenLabel ? (
          <span aria-hidden className="flex items-center">
            {chosen.leading}
          </span>
        ) : null}
        <span className="max-w-56 truncate">{chosenLabel || chosen?.label || label}</span>
        <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 transition-transform duration-(--duration-fast) ease-fast', open && 'rotate-180')} />
      </button>
      <div
        ref={pop}
        id={popId}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={cn(
          // Top layer, placed under the chip by `place` (fixed, clamped to the viewport).
          'fixed inset-auto m-0 w-72 max-w-[calc(100vw-(--spacing(4)))] rounded-card bg-surface p-3 text-ink shadow-e2',
          'max-h-[min(70dvh,--spacing(120))] overflow-y-auto',
          'opacity-100 transition-[opacity,translate,display,overlay] transition-discrete duration-(--duration-fast) ease-fast starting:-translate-y-1 starting:opacity-0',
        )}
      >
        <p className="mb-1.5 t-eyebrow text-muted uppercase">{label}</p>
        <div
          onPointerDown={() => {
            pointer.current = true;
          }}
          onClick={(e) => {
            // The input's own click (from the label): a pointer pick — also of the row already chosen,
            // which fires no change — closes. A keyboard Space only selects.
            if ((e.target as HTMLElement).tagName !== 'INPUT' || !pointer.current) return;
            pointer.current = false;
            close();
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            close();
          }}
          className="px-2"
        >
          <ChoiceChips name={name} layout="list" label={label} options={options} value={value} onChange={onChange} />
        </div>
        {after ? <div className="mt-1 border-t border-hairline px-2 pt-1">{after(close)}</div> : null}
      </div>
    </>
  );
}
