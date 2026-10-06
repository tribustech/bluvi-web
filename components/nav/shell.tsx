import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The shell's dimensions, in one place (ROADMAP §4, owner decision 2026-10-04: the bar and the pages
 * are full width with 16 / 24 / 32px gutters up to ~1680px of content, centred beyond that).
 *
 * SHELL_MAX is the column cap *including* the gutters: 1680 + 2×32 = 1744. The top bar's row, the
 * breadcrumb band, T3 heroes and <main> all use it, so the logo, the crumbs and the page content
 * share one left edge at every width.
 *
 * Written on the spacing scale (436 × 4 = 1744) rather than as a raw px value; SHELL_EDGE_PAD /
 * SHELL_EDGE_LEFT repeat the 436 for full-width elements and must change with it.
 * TODO(globals.css): promote to `--container-shell: 1744px` in @theme and use `max-w-shell`.
 */
export const SHELL_MAX = 'max-w-436';

/**
 * The two widths of the full-width rule (ROADMAP §4), in one place: the shell column above, and the
 * reading measure — 720 (180 × 4), the cap for running text and for the templates' page-state
 * cards (templates/stateCard.ts). Card grids are never capped: they auto-fill the column.
 * TODO(globals.css): `--container-prose: 720px` in @theme and `max-w-prose`.
 */
export const PROSE_MAX = 'max-w-180';

/**
 * A full-width element's start padding that puts its content on the shell column's left edge (the
 * logo's): the page gutter, or — past SHELL_MAX — half the space beside the column plus the 32px
 * gutter. For an element exactly as wide as the viewport (T2's `w-screen` root, offset by half the
 * scrollbar, so `100vw` is its own width): the same 436 as SHELL_MAX — change them together.
 */
export const SHELL_EDGE_PAD = 'md:pl-6 xl:pl-[max(var(--spacing)*8,calc((100vw_-_var(--spacing)*436)/2_+_var(--spacing)*8))]';
/** The same edge as a `left` offset, without the gutter (T2's panel box). */
export const SHELL_EDGE_LEFT = 'xl:left-[max(0px,calc((100vw_-_var(--spacing)*436)/2))]';

/** Page gutters: 16 below 768, 24 from 768, 32 from 1280 (the bar uses the same steps). */
export const SHELL_GUTTERS = 'px-4 md:px-6 xl:px-8';

/**
 * Bar component widths, on the spacing scale (each is used by exactly one component).
 * TODO(globals.css): --container-search / -menu-min / -menu-max / -panel tokens.
 */
export const BAR = {
  /** ≥1280 search field: 300. */
  searchField: 'w-75',
  /**
   * Account cluster = bell + gap + avatar: 48 + 0 + 48 below 768, 48 + 8 + 48 from 768,
   * 40 + 8 + 40 from 1280 (controls are 48 below 1280, 40 from 1280; Fundații §07).
   */
  accountMin: 'min-w-24',
  accountMinMd: 'md:min-w-26',
  accountMinXl: 'xl:min-w-22',
  /** Administrare / Contul meu dropdowns: 220–320. */
  menuWidth: 'min-w-55 max-w-80',
  /** Phone menu panel (from the right edge): 320, at most 86% of the viewport. */
  panelWidth: 'w-[min(--spacing(80),86vw)]',
} as const;

/**
 * A surface that runs edge to edge wherever it is rendered — in the layout or inside <main> (whose
 * column stops at SHELL_MAX, so a plain bg-surface would end at 1744 on a wide screen): the white is
 * a pseudo-element widened far past the column, and the shell's `overflow-x-clip` keeps it from
 * adding a horizontal scroll. Same trick as the T3 bands (templates/T3/metrics FULL_BLEED_SURFACE).
 */
export const FULL_BLEED_BG =
  "relative isolate before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:z-behind before:bg-surface before:content-['']";

/** Its bottom hairline, edge to edge the same way. */
export const FULL_BLEED_RULE =
  "after:pointer-events-none after:absolute after:bottom-0 after:-inset-x-[100vmax] after:h-px after:bg-hairline after:content-['']";

/**
 * A full-bleed band with the shell's centred column inside: the band (background, borders) spans
 * the viewport, the content lines up with the top bar. Use it for the breadcrumb band and for T3
 * heroes, so their white surface continues edge to edge under the full-width bar.
 */
export function ShellColumn({
  className,
  innerClassName,
  gutters = true,
  children,
}: {
  /** The band (full width): background, border. */
  className?: string;
  /** The centred column. */
  innerClassName?: string;
  /** false: the column only caps and centres; the content owns its padding. */
  gutters?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className={cn('mx-auto', SHELL_MAX, gutters && SHELL_GUTTERS, innerClassName)}>{children}</div>
    </div>
  );
}
