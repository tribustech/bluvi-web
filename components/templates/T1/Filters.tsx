'use client';

import { useId, type ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { COLUMN_CARD, ColumnHeader, TextAction } from './ColumnCard';
import { FOCUS_RING, PILL_H } from './toolbarStyles';
import { RING_SELECTED_CHECKED } from '../rings';

/*
 * The filter UI of T1. List pages filter from a horizontal bar (FilterBar.tsx — owner rule 2,
 * ROADMAP §4b): quick chips over the results, and «Filtre» opening FiltersSurface with every
 * section — a Sheet on the phone, a Dialog from 768 (Fundații §07 surface rule) — over a DRAFT,
 * confirmed by «Arată N …» whose count previews the draft (fish CompetitionFiltersSheet: everything
 * is draft-local until the button).
 *
 * FilterColumn stays for the CONTEXT columns of detail sub-pages (a lake's statistics, reviews,
 * stands: the page's sections and its options), which are not list filters.
 */

/** Desktop filter column: a surface card (same padding and header row as the aside) with «Resetează». */
export function FilterColumn({
  title = 'Filtre',
  onReset,
  canReset,
  children,
  footer,
}: {
  title?: string;
  onReset?: () => void;
  canReset?: boolean;
  children: ReactNode;
  /** Under the sections (a hint, a saved-search link). */
  footer?: ReactNode;
}) {
  const titleId = useId();
  return (
    // min-h-0 + the sections' own scroller: taller than the viewport, the card stays whole (header,
    // padding, radius) and the sections scroll inside it, fading out at the bottom edge.
    <section aria-labelledby={titleId} className={cn('flex min-h-0 flex-col gap-5', COLUMN_CARD)}>
      <ColumnHeader id={titleId} title={title} action={onReset ? <ResetButton onReset={onReset} disabled={!canReset} /> : null} />
      <div
        className={cn(
          // -mx/px: room for the rows' focus rings inside the scroller's clip; -mb/pb: the fade lands on
          // the card's bottom padding, so with nothing to scroll the last row is never faded.
          '-mx-4 -mb-4 flex min-h-0 flex-col gap-5 overflow-y-auto px-4 pb-4',
          '[mask-image:linear-gradient(to_bottom,black_calc(100%-var(--spacing)*4),transparent)]',
        )}
      >
        {children}
        {footer}
      </div>
    </section>
  );
}

function ResetButton({ onReset, disabled }: { onReset: () => void; disabled?: boolean }) {
  return (
    <TextAction onClick={onReset} disabled={disabled}>
      Resetează
    </TextAction>
  );
}

/**
 * Every filter section in a Sheet (phone) or a Dialog (from 768), opened by FilterBar's «Filtre».
 * `desktop="none"` keeps the old behaviour for a page that still docks a FilterColumn from 1280.
 */
export function FiltersSurface({
  open,
  onClose,
  title = 'Filtre',
  onReset,
  canReset,
  apply,
  initialSnap = 0.9,
  desktop = 'dialog',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  onReset?: () => void;
  canReset?: boolean;
  /** The confirm button: label previews the draft («Arată 12 concursuri»). */
  apply: { label: string; onApply: () => void; disabled?: boolean };
  /**
   * Phone sheet height: 0.5 when the sections fit in half the screen (no empty band above the
   * footer), 0.9 when they would scroll. TODO(kit): a measured 'fit' snap in surfaces/Sheet.
   */
  initialSnap?: 0.5 | 0.9;
  /** From 1280: a Dialog (default), or nothing when the page docks a FilterColumn there. */
  desktop?: 'dialog' | 'none';
  children: ReactNode;
}) {
  const bp = useBreakpoint();
  if (bp === 'desktop' && desktop === 'none') return null;

  const applyButton = (
    <div className="min-w-0 flex-1">
      <Button block onClick={apply.onApply} disabled={apply.disabled}>
        {apply.label}
      </Button>
    </div>
  );
  const footer = (
    <div className="flex items-center gap-4">
      {onReset ? <ResetButton onReset={onReset} disabled={!canReset} /> : null}
      {applyButton}
    </div>
  );

  if (bp !== 'mobile') {
    return (
      <Dialog open={open} onClose={onClose} title={title} closeButton actions={footer} className="max-h-[85dvh]">
        <div className="-mx-5 mt-2 flex max-h-[60dvh] flex-col gap-5 overflow-y-auto px-5 pb-1">{children}</div>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer} initialSnap={initialSnap}>
      <div className="flex flex-col gap-6 pt-2">{children}</div>
    </Sheet>
  );
}

/**
 * One filter question («Perioadă»): a caps legend, then the control. The eyebrow already names the
 * question, so a glyph is optional; when given it is a UI icon — a 24 OUTLINE Heroicon at 20, muted
 * like the legend (Fundații §05: solid is only for presence marks — a star, a pin, a check).
 */
export function FilterSection({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 flex items-center gap-1.5 t-eyebrow text-muted uppercase">
        {icon ? (
          <span aria-hidden className="flex size-5 items-center justify-center text-muted [&>svg]:size-5">
            {icon}
          </span>
        ) : null}
        {title}
      </legend>
      {children}
      {hint ? <p className="t-caption text-muted">{hint}</p> : null}
    </fieldset>
  );
}

export type Choice<V extends string> = {
  value: V;
  label: string;
  /**
   * What sets the choice apart when the label alone does not («10–11 oct.» for «Weekendul
   * acesta»). In the list layout a caption line under the label (never truncated away); in the
   * chips layout it follows the label on the same line, after «·».
   */
  detail?: string;
  /**
   * The LIVE dot (LiveDot) and nothing else. Chips: before the label. List rows: AFTER the label, so
   * every row of the group keeps one left edge (a leading mark on one row pushed its label in).
   */
  leading?: ReactNode;
};

/**
 * Single choice. Two looks over the same native radios (arrow keys move, a form posts it):
 *  - `chips` (default): pills (fish OptionPill) — selected = accent tint + accent ink + accent ring.
 *    Wraps; `scroll` keeps one line that scrolls instead (fish: the period row, whose weekend pill
 *    carries its dates). For the Sheet / Dialog, where the width is the screen's.
 *  - `list`: full-width rows (at least 40px, label left, check right, tint when selected) — for the
 *    narrow desktop filter column, where pills would wrap raggedly and leave orphans. A row grows
 *    for a `detail` line or a long label (two lines), never truncates.
 */
export function ChoiceChips<V extends string>({
  name,
  options,
  value,
  onChange,
  scroll = false,
  layout = 'chips',
  label,
}: {
  name: string;
  options: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  scroll?: boolean;
  layout?: 'chips' | 'list';
  /** Only when the chips are not inside a FilterSection (which names them). */
  label?: string;
}) {
  const uid = useId();
  const list = layout === 'list';
  return (
    <div
      role={label ? 'radiogroup' : undefined}
      aria-label={label}
      className={cn(
        list ? '-mx-2 flex flex-col gap-0.5' : 'flex gap-2',
        !list && (scroll ? '-mx-5 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'),
      )}
    >
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-accent',
              list
                ? 'min-h-10 rounded-control px-2 py-2 t-body text-ink-2 hover:bg-soft-fill hover:text-ink has-checked:bg-accent-tint has-checked:text-accent-ink has-checked:hover:bg-accent-tint'
                : cn(
                    PILL_H,
                    'shrink-0 rounded-full px-3.5 t-label whitespace-nowrap',
                    'bg-soft-fill text-ink-2 hover:text-ink',
                    // TODO(kit): a `--shadow-selected` token in globals.css (shared with every selected
                    // pill), then `has-checked:shadow-selected` — globals.css is outside this task.
                    'has-checked:bg-accent-tint has-checked:text-accent-ink', RING_SELECTED_CHECKED,
                  ),
            )}
          >
            <input
              type="radio"
              name={`${name}-${uid}`}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.leading && !list ? (
              <span aria-hidden className="flex items-center">
                {o.leading}
              </span>
            ) : null}
            {list ? (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="line-clamp-2">{o.label}</span>
                  {o.leading ? (
                    <span aria-hidden className="flex shrink-0 items-center">
                      {o.leading}
                    </span>
                  ) : null}
                </span>
                {o.detail ? <span className="block t-caption text-muted">{o.detail}</span> : null}
              </span>
            ) : (
              <span>{o.detail ? `${o.label} · ${o.detail}` : o.label}</span>
            )}
            {/* Presence mark: the 20 solid check (Fundații §05), not a scaled 24 outline. */}
            {list && checked ? <CheckIcon aria-hidden className="size-5 shrink-0" /> : null}
          </label>
        );
      })}
    </div>
  );
}

/**
 * A yes/no filter with its explanation (fish «Locuri libere» + Switch). Off is a NEUTRAL track
 * (muted: 4.9:1 on surface — the only neutral token past the 3:1 non-text minimum; faint is 2.6:1),
 * on is accent — never the lavender accent-disabled while enabled, which reads as «on but disabled».
 * The thumb is flat (no lift: nothing else in the column floats). Disabled is its own look, not a
 * fade: the faint track and a faint label, the description saying why.
 * TODO(kit): promote the switch to components/forms/Switch.tsx (+ /dev/kit) with a lighter off-track
 * token that still clears 3:1 — both live outside T1.
 */
export function FilterSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  /** Says why when `disabled` («Doar pentru concursurile viitoare»). */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * Not applicable right now. The switch stays MOUNTED (and its row keeps its height), so the
   * sections under it do not jump when the state changes — the description says why it is off.
   */
  disabled?: boolean;
}) {
  const id = useId();
  const descId = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className={cn('min-w-0 flex-1', disabled ? 'cursor-default' : 'cursor-pointer')}>
        <span className={cn('block t-body-strong', disabled ? 'text-faint' : 'text-ink')}>{label}</span>
        {description ? (
          <span id={descId} className="block t-caption text-muted">
            {description}
          </span>
        ) : null}
      </label>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked && !disabled}
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            'peer h-7 w-12 cursor-pointer appearance-none rounded-full bg-muted transition-colors duration-(--duration-fast) ease-fast checked:bg-accent',
            'disabled:cursor-default disabled:bg-faint',
            FOCUS_RING,
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.75 left-0.75 size-5.5 rounded-full bg-surface transition-[translate] duration-(--duration-fast) ease-select peer-checked:translate-x-5"
        />
      </span>
    </div>
  );
}
