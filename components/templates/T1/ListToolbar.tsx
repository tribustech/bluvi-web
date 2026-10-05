'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
// Fundații §05: UI actions are 24 outline (the ✕ clear included); solid is only for presence marks.
import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { CONTROL_H, filterButtonClass, FOCUS_RING, SEARCH_SHELL } from './toolbarStyles';

/**
 * The tool row over the list — fish CompetitionsSearchRow: the search pill grows, the filter
 * button and the view toggle sit at its end. One row at every width; from 1280 the filter button
 * hides itself (`desktopHidden`) because the filters are docked in ListPage's left column.
 */
export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2.5', className)}>{children}</div>;
}

/**
 * The search field. A real input (fish opens a search screen; on the web the field types in
 * place): Enter commits, nothing filters while typing — the same rule as fish, where only a pick
 * enters results mode. Without JS it is a plain GET form (`action` + `name`), so a server-rendered
 * list can read `?q=` itself.
 *
 * Controlled from outside only through `committed` (the current query, shown with a clear ✕);
 * the draft lives here.
 */
export function ListSearch({
  label,
  placeholder,
  committed,
  onCommit,
  onClear,
  action,
  name = 'q',
  className,
}: {
  /** Accessible name («Caută un concurs, o baltă sau un organizator»). */
  label: string;
  placeholder: string;
  committed?: string;
  onCommit?: (value: string) => void;
  onClear?: () => void;
  /** No-JS fallback: the form GETs here. */
  action?: string;
  name?: string;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(committed ?? '');
  // A new committed value from outside (a chip cleared, back from results) resets the draft.
  const [seen, setSeen] = useState(committed);
  if (committed !== seen) {
    setSeen(committed);
    setDraft(committed ?? '');
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    if (!onCommit) return;
    e.preventDefault();
    const value = draft.trim();
    if (value) onCommit(value);
  };

  return (
    <form role="search" action={action} onSubmit={submit} className={cn('min-w-0 flex-1', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className={SEARCH_SHELL}>
        <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          name={name}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          autoComplete="off"
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {draft ? (
          <button
            type="button"
            aria-label="Șterge căutarea"
            onClick={() => {
              setDraft('');
              if (committed) onClear?.();
              // The ✕ unmounts with the draft: keep a keyboard user in the field, not on <body>.
              inputRef.current?.focus();
            }}
            className={cn(
              'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill hover:text-ink',
              FOCUS_RING,
            )}
          >
            <XMarkIcon aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Opens FiltersSurface below 1280. Filled accent-ink with the count when anything is chosen (fish:
 * indigo5 square with a white glyph), so the state reads from across the room — the look is
 * filterButtonClass (toolbarStyles), shared with ToolbarSkeleton.
 */
export function FilterButton({
  count = 0,
  onClick,
  expanded,
  controls,
  desktopHidden = true,
  className,
}: {
  count?: number;
  onClick: () => void;
  expanded?: boolean;
  /** id of the surface it opens. */
  controls?: string;
  /** Hidden from 1280, where the filter column is always visible. */
  desktopHidden?: boolean;
  className?: string;
}) {
  const active = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={active ? `Filtre, ${count} active` : 'Filtre'}
      className={cn(filterButtonClass({ active }), desktopHidden && 'xl:hidden', className)}
    >
      <AdjustmentsHorizontalIcon aria-hidden />
      <span className="hidden md:inline">Filtre</span>
      {active ? (
        <span
          aria-hidden
          className="t-micro-strong flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-surface px-1 text-accent-ink tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export type ViewOption<V extends string> = { value: V; label: string; icon: ReactNode };

/**
 * Two (or three) ways to draw the same list — fish CompetitionDensityPreviewToggle «Listă / Afiș».
 * Both states are on screen at once with the selected one marked: a single icon button would have
 * to show either where you are or where you would go. Native radios (arrow keys move).
 * Labels from 768; below, the icon carries it and the label stays for screen readers.
 *
 * The kit SegmentedControl's geometry (radius 10, 3px inset, inner radius 7, t-control) at the
 * toolbar height. Two deliberate differences, both because it sits on the PAGE ground: the track is
 * surface + hairline (a soft-fill track vanishes on #f4f5fa) and the selected segment is the accent
 * tint (a raised white thumb on a white track would not read).
 * TODO(kit): SegmentedControl needs per-option `icon`, a visually hidden legend and an `onPage`
 * track; then this becomes a thin wrapper (this task may only touch T1).
 */
export function ViewToggle<V extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ViewOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn('shrink-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className={cn(CONTROL_H, 'flex items-stretch rounded-control bg-surface p-0.75 shadow-e0')}>
        {options.map((o) => (
          <label
            key={o.value}
            title={o.label}
            className={cn(
              'flex min-w-10.5 cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-3px)] px-2.5 t-control text-ink-2',
              'transition-[background-color,color] duration-(--duration-fast) ease-select hover:text-ink',
              'has-checked:bg-accent-tint has-checked:text-accent-ink',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-solid has-focus-visible:outline-accent',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
              {o.icon}
            </span>
            <span className="sr-only md:not-sr-only">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
