'use client';

import Link from 'next/link';
import { createContext, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { CountBadge, countLabel, type CountBadgeTone } from './CountBadge';
import { ACTION_TILE, BAR_CELL, ICON_TILE, type ActionTone } from './tones';

/**
 * The stuck bar runs edge to edge: it pulls back by the shell's gutters (16 / 24; SHELL_GUTTERS)
 * and its row takes exactly that bleed back as padding (8 + 16, 8 + 24), so the cells never move
 * under the thumb while the bar pins.
 */
const BLEED = '-mx-4 md:-mx-6';
const BLEED_PAD = 'group-data-stuck/bar:px-6 md:group-data-stuck/bar:px-8';

/**
 * Pressed feedback of a tile (Fundații: .7 for a card / tile; the kit's quick actions, T3
 * DetailQuickActions, use the same).
 *
 * TODO(kit): T3 DetailQuickActions and this bar are the same concept (a row of icon tiles with a
 * label and a count); promote one QuickActions to components/nav with a `variant` for the tile
 * size and colour (this task may only touch T5). Shared already: the t-label label, the pressed
 * opacity, spreading the cells across the card.
 */
const PRESSED = 'transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-70';
/** Air between the pinned bar and a focused element scrolled under it (WCAG 2.4.11). */
const FOCUS_AIR = 8;

type Layout = 'bar' | 'list';
const LayoutContext = createContext<Layout>('bar');

export interface DashboardActionsProps {
  /** Accessible name of the navigation («Scurtături bălții»). */
  label: string;
  /**
   * bar: the phone/tablet row (fish QuickActionsRow) — a floating card at rest that sticks under
   *   the top bar and turns into a full-bleed bar once pinned, so the shortcuts stay one tap away
   *   while the page scrolls under them. Its height never changes, so nothing jumps.
   * list: the desktop context column — the same shortcuts as jump links in a card, under the
   *   context they belong to (the lake). Context, not navigation: no «Administrare» title, no row for
   *   the page itself, no drill-in chevrons (the top bar owns «Administrare»).
   */
  layout?: Layout;
  /** List layout: the card's heading — what the shortcuts belong to (the lake's name). */
  title?: ReactNode;
  /** List layout: one line of fact under the title («21 de standuri · 6 ocupate acum»). */
  caption?: ReactNode;
  /**
   * Bar layout: once pinned, the row turns into a compact bar (fish operator panel: the labels fade
   * out once stuck) — icon tiles only on a phone (the labels stay as the links' names), less padding,
   * ~56px instead of ~90, so the pinned bar does not cover a fifth of a phone. The page below does
   * not move: the height it gives up is kept as margin under the bar.
   */
  compactWhenStuck?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * T5 sticky actions. Children are <DashboardAction>s. On a phone the shell's top bar hides on
 * scroll down; the pinned row then moves up to the top edge with it (shell UNDER_BAR_TOP).
 */
export function DashboardActions({ label, layout = 'bar', title, caption, compactWhenStuck = false, children, className }: DashboardActionsProps) {
  if (layout === 'list') return <ActionList label={label} title={title} caption={caption} className={className}>{children}</ActionList>;
  return (
    <StickyBar label={label} compact={compactWhenStuck} className={className}>
      {children}
    </StickyBar>
  );
}

function ActionList({ label, title, caption, className, children }: Omit<DashboardActionsProps, 'layout' | 'compactWhenStuck'>) {
  return (
    // A plain card: the column is already a landmark (DashboardLayout's aside); the shortcuts
    // inside are the one navigation, named by `label`.
    <div className={cn('rounded-card bg-surface p-2 shadow-e0', className)}>
      {title ? (
        // The card's inset (18) on the heading; the rows keep their own 10 inside the 8 of the card.
        <div className="flex flex-col gap-0.5 px-2.5 pt-2.5 pb-2">
          <h2 className="t-heading text-ink">
            {title}
          </h2>
          {caption ? <p className="t-caption text-muted">{caption}</p> : null}
        </div>
      ) : null}
      <nav aria-label={label}>
        <ul className="flex flex-col">
          <LayoutContext value="list">{children}</LayoutContext>
        </ul>
      </nav>
    </div>
  );
}

function StickyBar({ label, compact, className, children }: { label: string; compact: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  const restHeight = useRef(0);
  const shrunk = compact && stuck;

  // compactWhenStuck: the in-flow height stays the rest height (the difference as margin under the
  // bar), so nothing below jumps when the bar pins or unpins. Before paint, on the same commit.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !compact) return;
    if (!shrunk) {
      el.style.marginBottom = '';
      restHeight.current = el.offsetHeight;
      return;
    }
    el.style.marginBottom = `${Math.max(0, restHeight.current - el.offsetHeight)}px`;
  }, [compact, shrunk]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const root = document.documentElement;
    const measure = () => {
      frame = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      setStuck(el.getBoundingClientRect().top <= top + 0.5 && window.scrollY > 0);
      // Keyboard focus must not land under the top bar + this bar: reserve them as scroll padding
      // while the bar is shown (it is display:none from 1280, where nothing is pinned).
      const bar = el.offsetHeight;
      // The shell's top bar is the document's first <header> (56 / 64; it may be concealed, but
      // moving focus upward scrolls up and brings it back, so it is always reserved).
      const header = document.querySelector<HTMLElement>('header')?.offsetHeight ?? 0;
      root.style.scrollPaddingTop = bar > 0 ? `${header + bar + FOCUS_AIR}px` : '';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      root.style.scrollPaddingTop = '';
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label={label}
      data-stuck={stuck || undefined}
      data-compact={shrunk || undefined}
      className={cn(
        // Under the 56 / 64px top bar; at the top edge while the phone bar is hidden. Only `top`
        // moves (on the bar's own timing); the bleed is not animated — the row's padding takes it
        // back in the same frame, so nothing slides sideways.
        'group/bar sticky z-above',
        UNDER_BAR_TOP,
        stuck && BLEED,
        className,
      )}
    >
      <ul
        className={cn(
          // Equal cells at every width (BAR_CELL): a phone stacks tile over label, from 768 the tile
          // and its label sit side by side, centred in thirds of the card — never a cluster at the
          // start with the rest of the bar empty.
          // At rest a card like every other T5 card (e0); pinned it becomes a bar under the top
          // bar — square, no shadow, the bars' bottom hairline (TopBar, T3 pinned rows).
          'flex border-b border-transparent bg-surface px-2 py-2.5 md:gap-2',
          'transition-[border-radius,box-shadow,border-color] duration-(--duration-fast) ease-fast',
          'rounded-card shadow-e0 group-data-stuck/bar:rounded-none group-data-stuck/bar:border-hairline group-data-stuck/bar:shadow-none',
          'group-data-compact/bar:py-1.5',
          BLEED_PAD,
        )}
      >
        <LayoutContext value="bar">{children}</LayoutContext>
      </ul>
    </nav>
  );
}

export interface DashboardActionProps {
  href: string;
  label: string;
  /** A 24px outline Heroicon, at its own size in the page's 36px tile. */
  icon: ReactNode;
  tone?: ActionTone;
  /**
   * Unanswered count (fish: «99+» above 99, nothing at 0): the pending badge on the tile's corner
   * in the bar, a trailing «în așteptare» pill in the list (a row has room to say it in full).
   */
  badge?: number;
  /** What the badge counts, read after the label («în așteptare»). */
  badgeLabel?: string;
  /**
   * The badge's colour: `pending` (default) the «în așteptare» pair; `alert` the kit's solid red
   * notification count with white digits — a corner badge on the bar, a solid pill in the list.
   */
  badgeTone?: CountBadgeTone;
}

/** A jump link to one of the context's areas (never the page itself, never a drill-in). */
export function DashboardAction({ href, label, icon, tone = 'accent', badge, badgeLabel = 'în așteptare', badgeTone = 'pending' }: DashboardActionProps) {
  const layout = use(LayoutContext);
  const count = countLabel(badge);
  const srCount = count ? <span className="sr-only">, {count} {badgeLabel}</span> : null;

  if (layout === 'list') {
    return (
      <li>
        <Link href={href} className={cn('flex min-h-11 items-center gap-3 rounded-control px-2.5 py-1 hover:bg-soft-fill', PRESSED)}>
          <span aria-hidden className={cn(ICON_TILE, ACTION_TILE[tone])}>
            {icon}
          </span>
          <span className="min-w-0 flex-1 truncate t-body-strong text-ink">{label}</span>
          {count ? (
            badgeTone === 'alert' ? (
              <CountBadge count={badge} tone="alert" className="mr-1" />
            ) : (
              <StatusPill tone="pending" className="tabular-nums">
                <span aria-hidden>{count}</span>
              </StatusPill>
            )
          ) : null}
          {srCount}
        </Link>
      </li>
    );
  }

  const badgeEl = count ? <CountBadge count={badge} tone={badgeTone} /> : null;
  return (
    <li className="flex flex-1">
      <Link href={href} className={cn(BAR_CELL, 'rounded-control hover:bg-soft-fill', PRESSED)}>
        <span className="relative shrink-0">
          <span aria-hidden className={cn(ICON_TILE, ACTION_TILE[tone])}>
            {icon}
          </span>
          {badgeEl ? <span className="absolute -top-1.5 -right-2">{badgeEl}</span> : null}
        </span>
        {/* compactWhenStuck: icon only on a phone once pinned; the label stays the link's name. */}
        <span className="t-label whitespace-nowrap text-ink max-md:group-data-compact/bar:sr-only">{label}</span>
        {srCount}
      </Link>
    </li>
  );
}
