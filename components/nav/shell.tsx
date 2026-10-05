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
 * Written on the spacing scale (436 × 4 = 1744) rather than as a raw px value.
 * TODO(globals.css): promote to `--container-shell: 1744px` in @theme and use `max-w-shell`.
 */
export const SHELL_MAX = 'max-w-436';

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
