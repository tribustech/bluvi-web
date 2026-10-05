import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { iconButtonClass } from '@/components/nav/IconButton';
import { SEARCH_SHELL } from '@/components/templates/T1/toolbarStyles';
import { cn } from '@/components/ui/cn';

/*
 * T2 toolbar — fish components/map/MapChrome.tsx: back, a search (a button in the search shell on a
 * phone, an inline field from 768), «Filtre» (the T1 FilterButton at every width) and a chip rail.
 * On a phone it floats over the map (white controls with a shadow) and the back square leads it. From 768 the shell's breadcrumb carries the way back
 * (ROADMAP §4), so the back square is phone-only. 768–1279 it is a band of two rows: title + search
 * + «Filtre» + trailing, then the chip rail alone, so a filter turning on never re-wraps the rail.
 * From 1280 everything sits on one row that never wraps: the rail scrolls (right edge faded, as on a
 * phone) and the trailing action is its last item, so the band is 64px whatever is on. Controls are
 * the kit control height (48 below 1280, 40 from 1280 — Fundații §07); chips are 36, 40 from 1280.
 *
 * Disabled (first load, failed data) keeps every floating surface opaque at full elevation and only
 * dims what is on it (faint glyphs and text): a faded white control over the map shows the map
 * labels through it and reads as broken, not disabled.
 *
 * At the phone sheet's full rest T2Layout marks the toolbar wrapper `data-solid` (it becomes a white
 * header bar): the floating shadows drop to the e0 hairline there.
 */

/** What a disabled toolbar does to its content: faint glyphs, text and placeholders; surfaces stay. */
const DIMMED = '**:text-faint **:placeholder:text-faint';

/** Floating shadow → hairline when the toolbar is the solid header bar (T2Layout `data-solid`). */
export const T2_SOLID_E0 = '[[data-solid]_&]:shadow-e0';

export function T2Toolbar({
  title,
  leading,
  search,
  filtersButton,
  filters,
  trailing,
  railTrailing = trailing,
  disabled = false,
}: {
  /**
   * The page's h1 («Hartă bălți»). Visually hidden on a phone, where the search pill is the visible
   * heading (fish); from 768 a t-title1, the step every template's page title uses (T1 ListHeader).
   */
  title: string;
  /** Back to the section (T2BackLink). Phone only: from 768 the breadcrumb leads back. */
  leading?: ReactNode;
  /** The search: T2SearchPill on a phone, an inline field (T1 ListSearch) from 768. */
  search: ReactNode;
  /**
   * Right after the search, at every width: the T1 FilterButton (radius 10, the kit control height —
   * 48, 40 from 1280). On a phone it is the icon square beside the search; from 1280 it leads the rail.
   */
  filtersButton?: ReactNode;
  /** T2FilterChip × n — a scrolling rail on a phone and from 1280, wraps 768–1279. */
  filters?: ReactNode;
  /** «Șterge filtre» from 768: right end of the first row 768–1279 (a kit Button at the row's height). */
  trailing?: ReactNode;
  /**
   * The same action as the last item of the rail from 1280, in the chips' step and height
   * (T2RailAction). Default: `trailing`.
   */
  railTrailing?: ReactNode;
  /** Nothing to search or filter yet (first load) or the data failed: search, chips and trailing are inert. */
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-3 xl:flex-row xl:items-center">
      <div className="flex items-center gap-2.5 md:gap-3 xl:contents">
        {leading ? <div className="flex shrink-0 md:hidden">{leading}</div> : null}
        <h1 className="sr-only md:not-sr-only md:shrink-0 md:t-title1 md:whitespace-nowrap md:text-ink">{title}</h1>
        <div
          inert={disabled}
          className={cn('min-w-0 flex-1 md:max-w-120 xl:w-64 xl:max-w-none xl:flex-none 2xl:w-80', disabled && DIMMED)}
        >
          {search}
        </div>
        {filtersButton ? (
          <div inert={disabled} className={cn('flex shrink-0', disabled && DIMMED)}>
            {filtersButton}
          </div>
        ) : null}
        {trailing ? (
          <div inert={disabled} className="ml-auto hidden shrink-0 items-center gap-2 md:flex xl:hidden">
            {trailing}
          </div>
        ) : null}
      </div>
      {filters ? (
        <div
          role="group"
          aria-label="Filtre"
          inert={disabled}
          className={cn(
            // Phone: edge-to-edge rail; the padding inside the scroller keeps the chip shadows.
            '-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // fish MapChrome: the right edge fades to hint that more chips scroll in.
            '[mask-image:linear-gradient(to_right,black_calc(100%-var(--spacing)*8),transparent)]',
            // 768–1279 the chips wrap on their own row: every chip is reachable with a mouse.
            'md:mx-0 md:min-w-0 md:flex-wrap md:overflow-visible md:px-0 md:py-0 md:[mask-image:none]',
            // From 1280 one line that scrolls, faded at the right edge like the phone rail: a filter
            // turning on never grows the band. The 4px inset keeps the focus rings and shadows; the
            // right padding keeps the last item out of the fade when everything fits.
            'xl:-m-1 xl:flex-1 xl:flex-nowrap xl:overflow-x-auto xl:p-1 xl:pr-8',
            'xl:[mask-image:linear-gradient(to_right,black_calc(100%-var(--spacing)*8),transparent)]',
            disabled && DIMMED,
          )}
        >
          {filters}
          {railTrailing ? <div className="hidden shrink-0 items-center xl:flex">{railTrailing}</div> : null}
        </div>
      ) : railTrailing ? (
        <div inert={disabled} className="hidden shrink-0 items-center gap-2 xl:ml-auto xl:flex">
          {railTrailing}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The back square: T1 ListHeader's BACK (the kit icon button, 48 / 40 from 1280, on a surface, the
 * arrow glyph, an explicit accent focus ring) floating over the map with the e2 shadow — e0 when
 * the toolbar is the solid header bar. Phone only (T2Toolbar).
 * TODO(kit): export T1's BACK class and reuse it here (this task may only touch T2).
 */
export function T2BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={iconButtonClass({
        className: cn(
          'bg-surface text-ink shadow-e2 hover:bg-soft-fill',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          T2_SOLID_E0,
        ),
      })}
    >
      <ArrowLeftIcon aria-hidden />
    </Link>
  );
}

/**
 * The phone search (fish MapChrome's pill): a button showing the committed search (a place, or the
 * placeholder) that opens the search dialog. Built on the T1 search shell (forms/Field controlShell:
 * radius 10, the kit focus border and ring, 48px) — the same box as the inline field from 768 — and
 * floating over the map with the e2 shadow (e0 when the toolbar is the solid header bar). «Filtre»
 * is its own control beside it (T2Toolbar `filtersButton`), not a target hidden inside this one.
 */
export function T2SearchPill({
  summary,
  placeholder = false,
  searchLabel,
  onSearch,
}: {
  /** What is searched, or the placeholder text. */
  summary: string;
  /** `summary` is the placeholder (muted). */
  placeholder?: boolean;
  /** Accessible name of the search button («Filtrează bălțile de pe hartă»). */
  searchLabel: string;
  onSearch: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSearch}
      aria-label={searchLabel}
      className={cn(SEARCH_SHELL, 'w-full cursor-pointer text-left shadow-e2', T2_SOLID_E0)}
    >
      <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
      <span className={cn('min-w-0 flex-1 truncate t-body', placeholder ? 'text-muted' : 'text-ink')}>{summary}</span>
    </button>
  );
}

/**
 * «Open» look of a control whose panel is open (aria-expanded): the selected-choice look of the kit
 * chips (T1 ChoiceChips — accent tint, accent ink, 1.5px accent inset).
 * TODO(kit): a `--shadow-selected` token shared with ChoiceChips (globals.css is outside this task).
 */
export const T2_EXPANDED =
  'aria-expanded:bg-accent-tint aria-expanded:text-accent-ink aria-expanded:shadow-[inset_0_0_0_1.5px_var(--color-accent)] aria-expanded:hover:bg-accent-tint';

/**
 * The trailing action of the rail from 1280 («Șterge filtre»): a text action in the chips' step and
 * height (t-label, 16px icon, 36 / 40 from 1280, radius 10 — an action, not a state pill), so the
 * rail reads as one family and its baseline does not jump.
 */
export function T2RailAction({ icon, children, onClick }: { icon?: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-2.5 t-label whitespace-nowrap text-ink xl:h-10',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        '[&>svg]:size-4 [&>svg]:shrink-0',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * A filter chip on the toolbar rail (fish components/FilterChip.tsx): «Regim», «Pești · 2»,
 * «Rezervări». Active = accent-ink fill (AA at t-label; the same «filter on» as T1 ActiveFilters).
 * `toggle` chips flip a value in place (aria-pressed); `menu` chips open the panel for their
 * section (aria-haspopup). Only for the rail — choices inside the filter panel are the kit choice
 * chips (T1 FilterSection / ChoiceChips, T2CheckChips).
 */
export function T2FilterChip({
  label,
  count = 0,
  active = false,
  icon,
  kind,
  onClick,
  expanded,
  disabled = false,
  disabledHint,
  describedBy,
  className,
}: {
  label: string;
  /** Selected values: renders «Pești · 2». */
  count?: number;
  active?: boolean;
  /** A 16px outline icon. */
  icon?: ReactNode;
  kind: 'toggle' | 'menu';
  onClick: () => void;
  /** `menu` chips: whether the panel they open is open. */
  expanded?: boolean;
  /** The data behind the chip did not load: it cannot filter («Indisponibil momentan»). */
  disabled?: boolean;
  /** Said with the name while disabled. Default «indisponibil momentan». */
  disabledHint?: string;
  /** id of what explains a disabled chip (the page's «Unele detalii nu s-au încărcat» notice). */
  describedBy?: string;
  className?: string;
}) {
  const text = count > 0 ? `${label} · ${count}` : label;
  const name = disabled ? `${label}, ${disabledHint ?? 'indisponibil momentan'}` : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name}
      aria-describedby={disabled ? describedBy : undefined}
      title={disabled ? 'Indisponibil momentan' : undefined}
      aria-pressed={kind === 'toggle' && !disabled ? active : undefined}
      aria-haspopup={kind === 'menu' ? 'dialog' : undefined}
      aria-expanded={kind === 'menu' ? expanded : undefined}
      className={cn(
        'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 t-label whitespace-nowrap xl:h-10',
        'transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        '[&>svg]:size-4 [&>svg]:shrink-0',
        disabled
          ? 'cursor-not-allowed bg-surface text-faint shadow-e1 md:shadow-e0'
          : active
            ? 'bg-accent-ink text-on-accent shadow-e1 hover:brightness-110'
            : 'bg-surface text-ink shadow-e1 hover:bg-soft-fill md:shadow-e0',
        // The chip whose section is open in the panel.
        kind === 'menu' && !disabled && T2_EXPANDED,
        T2_SOLID_E0,
        className,
      )}
    >
      {icon}
      {text}
    </button>
  );
}
