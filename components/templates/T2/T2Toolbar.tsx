import { ArrowLeftIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { iconButtonClass } from '@/components/nav/IconButton';
import { FilterBar } from '@/components/templates/T1/FilterBar';
import { filterChipClass, SEARCH_SHELL } from '@/components/templates/T1/toolbarStyles';
import { cn } from '@/components/ui/cn';
import { RING_SELECTED_EXPANDED } from '../rings';

/*
 * T2 toolbar — fish components/map/MapChrome.tsx, in the owner's map-view anatomy (rule 7,
 * ROADMAP §4b, imobiliare.ro): the Bălți / Ape publice segmented switch, the search, then the
 * filters. From 1280 ONE row: [switch][search, growing][the T1 FilterBar, its chips on one line that
 * scrolls sideways if they outgrow it] — the map gains the row's height. 768–1279 two rows:
 * [switch][search], then the T1 FilterBar — «Filtre» leading with a
 * divider, the quick chips (T2FilterChip = the T1 chip primitive: 36px, disclosure chevron on the
 * menu chips, the chosen value in place of the question) and «Resetează» at the end: one chip
 * primitive and one bar anatomy for T1 and T2. On a phone the toolbar floats over the map: the back
 * square, the search pill and the «Filtre» square, the chips scrolling sideways under them; the
 * shell's breadcrumb carries the way back from 768 (ROADMAP §4), so the back square is phone-only.
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
  switcher,
  search,
  filtersButton,
  filters,
  trailing,
  railTrailing = trailing,
  onOpenFilters,
  filterCount = 0,
  filtersExpanded,
  onReset,
  canReset = false,
  disabled = false,
}: {
  /**
   * The page's h1 («Hartă bălți»). Visually hidden on a phone, where the search pill is the visible
   * heading (fish), and wherever a `switcher` names the page; otherwise a t-title1 from 768.
   */
  title: string;
  /** Back to the section (T2BackLink). Phone only: from 768 the breadcrumb leads back. */
  leading?: ReactNode;
  /**
   * The Bălți / Ape publice segmented control (owner rule 7: the map's header mirrors
   * imobiliare.ro's — the segmented switch first, then the search, then the filters). From 768.
   */
  switcher?: ReactNode;
  /** The search: T2SearchPill on a phone, an inline field (T1 ListSearch) from 768. */
  search: ReactNode;
  /**
   * Right after the search. With `onOpenFilters` it is the PHONE's «Filtre» square only (from 768
   * the bar's own «Filtre» chip leads the chips, T1 FilterBar); without, it shows at every width.
   */
  filtersButton?: ReactNode;
  /** T2FilterChip × n — the quick chips of the T1 FilterBar (one bar anatomy with T1). */
  filters?: ReactNode;
  /** Legacy: an action at the right end of the first row 768–1279 (pages without `onReset`). */
  trailing?: ReactNode;
  /** Legacy: the same action as the last item of the chips from 1280. Default: `trailing`. */
  railTrailing?: ReactNode;
  /** Opens every filter: the bar's leading «Filtre» chip from 768 (T1 FilterBar). */
  onOpenFilters?: () => void;
  /** Active filters (the «Filtre» badge). */
  filterCount?: number;
  filtersExpanded?: boolean;
  /** «Resetează» at the end of the chips, once anything is chosen (T1 FilterBar). */
  onReset?: () => void;
  canReset?: boolean;
  /** Nothing to search or filter yet (first load) or the data failed: search, chips and trailing are inert. */
  disabled?: boolean;
}) {
  const barMode = Boolean(onOpenFilters);
  return (
    <div className="flex flex-col gap-2 md:gap-3 xl:flex-row xl:items-center xl:gap-4">
      <div className="flex items-center gap-2.5 md:gap-3 xl:min-w-0 xl:flex-[1_1_26rem]">
        {leading ? <div className="flex shrink-0 md:hidden">{leading}</div> : null}
        <h1 className={cn('sr-only', !switcher && 'md:not-sr-only md:shrink-0 md:t-title1 md:whitespace-nowrap md:text-ink')}>{title}</h1>
        {switcher ? <div className="hidden shrink-0 md:flex">{switcher}</div> : null}
        <div
          inert={disabled}
          className={cn('min-w-0 flex-1 md:max-w-120 xl:max-w-none', disabled && DIMMED)}
        >
          {search}
        </div>
        {filtersButton ? (
          <div inert={disabled} className={cn('flex shrink-0', barMode && 'md:hidden', disabled && DIMMED)}>
            {filtersButton}
          </div>
        ) : null}

      </div>
      {filters || barMode ? (
        <div inert={disabled} className={cn('min-w-0 xl:flex-[0_1_auto]', disabled && DIMMED)}>
          {/* The T1 FilterBar (owner: one chip primitive, one bar anatomy for T1 and T2): «Filtre»
              leads with a divider (from 768 — the phone has the square above), the chips, and
              «Resetează» at the end. A rail that scrolls on a phone, wrapping from 768. */}
          <FilterBar
            label="Filtre"
            count={filterCount}
            onOpenFilters={onOpenFilters}
            expanded={filtersExpanded}
            filtersClassName="max-md:hidden"
            onReset={onReset}
            canReset={canReset}
            end={!barMode && railTrailing ? <div className="hidden md:flex">{railTrailing}</div> : undefined}
            // From 1280 the chips stay on the search's line: one line, scrolling sideways if needed.
            className="max-md:-mx-4 max-md:px-4 max-md:py-1 xl:[&>div]:flex-nowrap xl:[&>div]:overflow-x-auto"
          >
            {filters}
          </FilterBar>
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
 * chips (T1 ChoiceChips — accent tint, accent ink, the templates' one selected ring, ../rings.ts).
 */
export const T2_EXPANDED =
  `aria-expanded:bg-accent-tint aria-expanded:text-accent-ink ${RING_SELECTED_EXPANDED} aria-expanded:hover:bg-accent-tint`;

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
 * A quick filter chip of the T2 bar — the T1 chip primitive (filterChipClass: 36px pill, surface +
 * hairline at rest, the selected tint + ring holding a choice), so T1 and T2 chips are one design:
 * - `toggle` flips a value in place (aria-pressed), like T1 FilterChipToggle;
 * - `menu` opens the panel on its section (aria-haspopup) with T1's disclosure chevron, and shows
 *   the chosen value instead of the question («Crap +1», «Peste 4,5»), like T1 FilterChipButton.
 * Over the phone's map it floats (e1 shadow). Only for the bar — choices inside the filter panel are
 * the kit choice chips (T1 FilterSection / ChoiceChips, T2CheckChips).
 */
export function T2FilterChip({
  label,
  value,
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
  /** `menu`: the chosen value, shown instead of the label («Crap +1»). */
  value?: string | null;
  /** Selected values when the page has no value text: «Județe (2)». Prefer `value`. */
  count?: number;
  active?: boolean;
  /** A leading 18px outline icon. */
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
  const shown = value || (count > 0 ? `${label} (${count})` : null);
  const text = shown ?? label;
  const name = disabled ? `${label}, ${disabledHint ?? 'indisponibil momentan'}` : value ? `${label}: ${value}` : undefined;
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
        filterChipClass({ active: active && !disabled }),
        'max-md:shadow-e1',
        disabled && 'cursor-not-allowed text-faint',
        T2_SOLID_E0,
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="flex items-center [&>svg]:size-4.5">
          {icon}
        </span>
      ) : null}
      <span className="max-w-48 truncate">{text}</span>
      {kind === 'menu' ? (
        <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 transition-transform duration-(--duration-fast) ease-fast', expanded && 'rotate-180')} />
      ) : null}
    </button>
  );
}
