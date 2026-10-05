import { controlShell } from '@/components/forms/Field';
import { cn } from '@/components/ui/cn';

/*
 * Toolbar class lists, in a module with no 'use client' so a Server Component (ListPageSkeleton,
 * a route's Suspense fallback) gets the strings themselves, not client references.
 */

/** Controls on the toolbar share the kit control height: 48 below 1280, 40 from 1280 (Fundații §07, Button). */
export const CONTROL_H = 'h-12 xl:h-10';

/**
 * The search shell: the kit input shell (forms/Field controlShell — radius 10, 2px accent border +
 * tint ring and surface on focus) at the toolbar height. At rest it sits on surface + hairline
 * instead of the shell's soft-fill: the toolbar is on the page ground, where soft-fill (#f2f4f7 on
 * #f4f5fa) would make the field invisible. The resting hairline is an OUTLINE on the box's outer
 * edge (-1 offset), not shadow-e0: the shell's 2px transparent border would push an inset shadow
 * 2px in, leaving a white band outside the line and an edge that does not meet FilterButton's and
 * ViewToggle's. On focus the outline steps aside for the shell's own accent border + ring.
 * The `!` overrides are needed because cn() does not merge.
 * Exported so T6 FlowSearch can share it (TODO(kit): a `searchShellClass()` in components/forms).
 */
export const SEARCH_SHELL = cn(
  controlShell(false),
  'h-12! bg-surface! pr-1.5 outline-1 -outline-offset-1 outline-hairline focus-within:outline-transparent xl:h-10!',
);


/**
 * A divider drawn on the PAGE ground (the ListTabs row, ListHeader's reserved band, TabsSkeleton,
 * T3 DetailTabs on the page). The hairline token is tuned for white surfaces: #eff1f5 on the page's
 * #f4f5fa is ~1.03:1 and does not show, so the active tab's underline floated over nothing. This is
 * the shimmer step (#e4e7ec, with its own dark value) — the first neutral that reads on the ground.
 * Keep `border-hairline` inside cards.
 * TODO(kit): a `--color-hairline-page` token in globals.css (outside T1); then swap it in here.
 */
export const PAGE_RULE = 'border-shimmer';

/**
 * Keyboard focus ring of every T1 page-ground control. Tailwind 4: `outline-2` only sets the width;
 * `outline-solid` is stated so a base `outline-hidden` / `outline-none` can never swallow it.
 */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/**
 * Tools that rest on the PAGE ground (FilterButton, the header's toggles, the back square): surface
 * + hairline at rest (soft-fill would vanish on #f4f5fa), soft-fill on hover; pressed / active =
 * accent tint + accent ink. The kit control height (48 / 40), the kit press (opacity .8).
 * `iconOnly`: a square below 768 (24 glyph), labelled from 768 (the kit Button's 20 glyph slot).
 * TODO(kit): Button / IconButton `pressed` and a surface «on page» variant in components/ui.
 */
export function pageToolClass({ pressed = false, iconOnly = true }: { pressed?: boolean; iconOnly?: boolean } = {}) {
  return cn(
    CONTROL_H,
    'relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-control t-body-strong whitespace-nowrap shadow-e0',
    'transition-[background-color,color,filter,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
    FOCUS_RING,
    iconOnly ? 'w-12 md:w-auto md:px-4 [&>svg]:size-6 md:[&>svg]:size-5' : 'px-4 [&>svg]:size-5',
    pressed ? 'bg-accent-tint text-accent-ink hover:bg-accent-tint-2' : 'bg-surface text-ink hover:bg-soft-fill',
  );
}

/**
 * FilterButton's look (and ToolbarSkeleton's, so the two never drift): a page tool at rest; filled
 * accent-ink with the count when anything is chosen — accent-ink, not accent, so the «Filtre» label
 * stays AA (white on accent is 4.47:1); the kit filled-variant hover (brightness-95, Fundații §06).
 * Below 768 a 48 square with the 24 glyph; from 768 the label and the kit's 20 icon slot.
 */
export function filterButtonClass({ active = false }: { active?: boolean } = {}) {
  return cn(
    CONTROL_H,
    'relative flex min-w-12 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-control px-3 t-body-strong md:gap-2 md:px-4',
    '[&>svg]:size-6 md:[&>svg]:size-5',
    'transition-[background-color,filter,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
    FOCUS_RING,
    active ? 'bg-accent-ink text-on-accent hover:brightness-95' : 'bg-surface text-ink shadow-e0 hover:bg-soft-fill',
  );
}

/**
 * Tappable pill height (ChoiceChips, ActiveFilters): 36 at every width — the kit's compact control
 * height (Button size="compact") and the height T2CheckChips already uses, so the same chip is one
 * height across the sibling templates.
 * TODO(kit): a Chip in components/forms (ChoiceChips, ActiveFilters, T2CheckChips) owning this rule.
 */
export const PILL_H = 'h-9';
