import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { FULL_BLEED_BG, FULL_BLEED_RULE, SHELL_MAX, ShellColumn } from '@/components/nav/shell';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { COLUMN_STICKY_TOP } from '@/components/templates/T3/metrics';
import { cn } from '@/components/ui/cn';
import { TRACK_GAP_X, TRACKS } from '../tracks';
import { STATE_CARD_FRAME } from '../stateCard';

/*
 * T6 «Single-task flow» (ROADMAP §4) — scale, capture, raffle, penalties, join with code.
 * One primary task per screen, big touch targets, an explicit confirmation.
 *
 * Geometry (shell: full width up to 1680 + gutters, centred beyond):
 * - <768: the page ground (as T4Frame), the task a flush white section edge to edge (fish
 *   ScrollScreen is white) — notice, gates and aside cards sit on the ground beside it, never as
 *   cards floating on white. Header with a 48px back button, the actions in a bar stuck to the
 *   bottom of the viewport.
 * - 768–1279: header band (surface, hairline), the task a card on the page ground; the actions
 *   are T4ActionBar's edge-to-edge surface bar stuck to the viewport bottom — the page keeps the
 *   viewport's height under the shell's chrome (top bar + breadcrumb band), so on a short step the
 *   bar rests on the bottom edge, never mid-screen, and the page does not scroll by a blank strip.
 * - Below 1280 the bar's height is the root's scroll-padding-bottom while a flow with actions is
 *   mounted, so a focused field (Tab, or a failed submit) is scrolled clear of it (WCAG 2.4.11).
 * - ≥1280: two columns — the task (fluid) and a 400px aside (context, history, summary) that
 *   sticks under the top bar (COLUMN_STICKY_TOP, as T1/T3/T5); the actions dock at the bottom of
 *   the aside, next to what they act on. The column is capped at the viewport (T1 ListPage's cap):
 *   only the aside scrolls inside it, the actions never shrink, so the CTA is always on screen
 *   however long «Adăugate acum» or a stand's weighings grow.
 * The body shares the header's column (SHELL_MAX), so above 1744 both are centred on one edge.
 * Cards share T4's padding rhythm (16 / 20 / 24 at <768 / 768 / 1280): notice, task, aside and
 * action bar content start on one left edge at every width.
 *
 * The actions are mounted once: below 1280 their wrapper is `display: contents`, so the bar is a
 * flex item of the page column (sticky to the viewport bottom); from 1280 the same element sits
 * in the aside column. One copy means one tab order and one default button for Enter.
 */

/**
 * The bar's height plus a 16px gap as the root's scroll padding, below 1280 only (docked from 1280):
 * <768 two stacked 48px buttons + an optional hint line (≈ 160), 768–1279 one 48px row (≈ 72).
 */
const BAR_SCROLL_PAD =
  '[:root:has(&)]:scroll-pb-44 md:[:root:has(&)]:scroll-pb-24 xl:[:root:has(&)]:scroll-pb-0';

/** ≥1280: the task and its wide companion column (360 / 400, the shared template scale ../tracks.ts). */
const ASIDE_W = cn('xl:grid xl:items-start', TRACKS.mainWide, TRACK_GAP_X);

type FlowLayoutProps = {
  /** <FlowHeader> (a full-bleed band). */
  header: ReactNode;
  /** A notice (T4Notice: role, «se deschide la start», demo…), above the task at every width. */
  notice?: ReactNode;
  /** The task itself. */
  children: ReactNode;
  /** ≥1280: the right column. Below: after the task (`asideMobile="after"`) or not shown. */
  aside?: ReactNode;
  asideMobile?: 'after' | 'hidden';
  /** <FlowActions>: bottom bar below 1280, docked under the aside from 1280. */
  actions?: ReactNode;
  /** The task region's accessible name (its heading id). */
  labelledBy?: string;
  /**
   * bare: the task region is not a card — for content that is a card itself (a T4Gate: signed
   * out, empty, load error), so a card never sits inside a card.
   */
  variant?: 'card' | 'bare';
  /**
   * From 768 the task column is capped at 560 and centred (a gate, an empty or error state) — the
   * width T4Gate caps itself at, so the gate is centred too, not stuck to the column's left edge.
   */
  narrow?: boolean;
  /**
   * Below 768 the task region grows to fill the screen (a confirmation centred between header
   * and action bar). From 768 it hugs its content. A `card` task then also meets the header band
   * and the bar (no 16px ground strips): white from the header down to the bar, as fish's ScrollScreen.
   */
  fill?: boolean;
  /** The task region is a loading skeleton (aria-busy): the switch to loaded is not a silent swap. */
  busy?: boolean;
  className?: string;
};

export function FlowLayout({
  header,
  notice,
  children,
  aside,
  asideMobile = 'after',
  actions,
  labelledBy,
  variant = 'card',
  narrow = false,
  fill = false,
  busy = false,
  className,
}: FlowLayoutProps) {
  const hasAside = Boolean(aside);
  return (
    // Up to 1279 at least the viewport under the shell's chrome — the top bar (56 / 64 from 768)
    // and, from 768, SiteLayout's breadcrumb band (40: 16 + the 24px row) — so the action bar sits
    // on the bottom edge even on a short step; from 1280 the bar is docked in the aside and the page
    // hugs its content. TODO(shell): read a --shell-chrome-h set by SiteLayout instead of 14 / 26.
    <div
      className={cn(
        'flex min-h-[calc(100dvh-(--spacing(14)))] flex-col md:min-h-[calc(100dvh-(--spacing(26)))] xl:min-h-0',
        Boolean(actions) && BAR_SCROLL_PAD,
        className,
      )}
    >
      {header}
      <div
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-4 pt-4 md:gap-6 md:px-6 md:pt-6 xl:px-8 xl:pt-8',
          SHELL_MAX,
          // With actions the bar is the last thing on the page below 1280 (edge to edge, no gap
          // under it); from 1280 it is docked in the aside, so the page gets its bottom padding.
          actions ? 'pb-0 xl:pb-8' : 'pb-4 md:pb-8',
          // fill + card on a phone: white from the header band to the bar (no ground strip above or
          // below the task; a mobile aside keeps the gap it needs).
          fill && variant === 'card' && !notice && 'max-md:pt-0',
          fill && variant === 'card' && (!hasAside || asideMobile === 'hidden') && 'max-md:gap-0',
          hasAside && ASIDE_W,
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-col gap-4 md:gap-6',
            // The templates' one state frame (../stateCard.ts): 720, centred.
            narrow && STATE_CARD_FRAME,
            fill && 'flex-1 md:flex-none',
          )}
        >
          {notice ? <div className="px-4 md:px-0">{notice}</div> : null}
          <section
            aria-labelledby={labelledBy}
            aria-busy={busy || undefined}
            className={cn(
              'flex min-w-0 flex-col gap-4 px-4 md:gap-6',
              // Phone: a flush white section on the ground (16px all round); from 768 a card.
              variant === 'card' ? 'bg-surface py-4 md:rounded-card md:p-5 md:shadow-e0 xl:p-6' : 'md:px-0',
              fill && 'flex-1 md:flex-none',
            )}
          >
            {children}
          </section>
        </div>
        {hasAside || actions ? (
          <div
            className={cn(
              'contents',
              // 112 = the 64px bar + 24 above + 24 below (T1 ListPage's cap).
              hasAside &&
                cn('xl:sticky xl:flex xl:max-h-[calc(100dvh-(--spacing(28)))] xl:min-w-0 xl:flex-col xl:gap-4', COLUMN_STICKY_TOP),
            )}
          >
            {hasAside ? (
              <aside
                aria-label="Detalii"
                className={cn(
                  'min-w-0 flex-col gap-4 px-4 md:px-0 xl:flex xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain',
                  asideMobile === 'after' ? 'flex' : 'hidden',
                )}
              >
                {aside}
              </aside>
            ) : null}
            {actions ? (
              // mt-auto: on a short step the bar still sits at the bottom of the screen. md:-mx-6
              // cancels the page gutters (edge to edge, as T4ActionBar); from 1280 it is a card.
              <div
                className={cn(
                  'sticky bottom-0 z-sticky mt-auto md:-mx-6 xl:mx-0',
                  // Docked: the column's last child, never shrunk by a long aside.
                  hasAside ? 'xl:static xl:mt-0 xl:shrink-0' : 'xl:bottom-6',
                )}
              >
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type FlowHeaderProps = {
  /** The step's title («Alege standul», «Adaugă captură»). Gets `id` for the region label. */
  title?: string;
  /** No `title` yet (a skeleton): this placeholder fills the title's line instead of an h1. */
  titleBar?: ReactNode;
  id?: string;
  /** Caps line above the title: what the task belongs to (the competition). */
  eyebrow?: ReactNode;
  /** One line under the title: lake, team badge… */
  meta?: ReactNode;
  /** Back target (the previous step or the screen that opened the flow). */
  backHref?: string;
  backLabel?: string;
  /** The skeleton's stand-in for the back button (same box, no link). */
  backPlaceholder?: ReactNode;
  /** Right side: a status pill, a step counter. */
  trailing?: ReactNode;
};

/**
 * fish's BackButton: T3's header chip on the white band (soft-fill, ink icon, hover one step
 * darker), the same control as T4Header's back; 48 / 40 from 1280 like every shell control.
 */
const BACK = headerChipClass();

/**
 * The flow's header: a full-bleed surface band with a hairline edge from 768 (as T4Header), so a
 * status pill always sits on white. Back · eyebrow · title (title1, the page-title step from
 * 768) · meta, the trailing pill at the right. Not sticky: the top bar is.
 */
export function FlowHeader({
  title,
  titleBar,
  id,
  eyebrow,
  meta,
  backHref,
  backLabel = 'Înapoi',
  backPlaceholder,
  trailing,
}: FlowHeaderProps) {
  return (
    // Full bleed wherever it is rendered (inside <main> too): white and hairline run edge to edge.
    <ShellColumn className={cn(FULL_BLEED_BG, FULL_BLEED_RULE, 'max-md:after:hidden')} innerClassName="pt-2 pb-3 md:pt-4 md:pb-4 xl:py-6">
      <header className="flex items-center gap-3 xl:gap-4">
        {backHref ? (
          <Link href={backHref} aria-label={backLabel} className={BACK}>
            <ChevronLeftIcon aria-hidden />
          </Link>
        ) : (
          backPlaceholder
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {eyebrow ? <p className="t-eyebrow truncate text-muted uppercase">{eyebrow}</p> : null}
          {title ? (
            // tabIndex -1: the screen can move focus here (after «Reîncearcă» lands the step).
            <h1 id={id} tabIndex={id ? -1 : undefined} className="t-title1 text-ink outline-none md:t-page-title">
              {title}
            </h1>
          ) : (
            <p aria-hidden className="t-title1 md:t-page-title">
              {titleBar}
            </p>
          )}
          {meta ? <div className="t-caption mt-0.5 flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-muted">{meta}</div> : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </header>
    </ShellColumn>
  );
}

type FlowSectionProps = {
  title: ReactNode;
  /** Right of the title: «7 standuri · 2 libere». */
  meta?: ReactNode;
  /** Before the title: a sector dot, an icon. */
  marker?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
};

/** A titled group of choices inside the task (one per sector). */
export function FlowSection({ title, meta, marker, id, children, className }: FlowSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        {marker}
        <h2 id={id} className="t-title2 text-ink">
          {title}
        </h2>
        {meta ? <span className="t-caption ml-auto text-muted">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

type FlowAsideCardProps = {
  title: string;
  id?: string;
  /** Right of the title (a count, a link). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A block of the aside (summary, history): a card at every width. */
export function FlowAsideCard({ title, id, meta, children, className }: FlowAsideCardProps) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', className)}>
      <div className="flex items-center gap-2">
        <h2 id={id} className="t-heading text-ink">
          {title}
        </h2>
        {meta ? <span className="t-caption ml-auto text-muted">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

type FlowActionsProps = {
  /** The one primary action (a kit Button / ButtonLink). */
  primary: ReactNode;
  /** At most one alternative («Adaugă și continuă»): outline. */
  secondary?: ReactNode;
  /** Why the actions are off, or what will happen («Se adaugă 3 capturi»). */
  hint?: ReactNode;
  /** Turns every button off (a disabled fieldset); say why in `hint`. */
  disabled?: boolean;
};

/**
 * The action bar — T4ActionBar's surface, insets and gaps class for class (12 / 24 / 16, gap 10
 * below 768, e1 + hairline card from 1280). TODO(kit): render T4ActionBar itself once it takes a
 * `docked` option — today it carries its own sticky offset and -mx-4 (FlowLayout's column has no
 * phone gutter) and puts the CTA last in the DOM (here it must be first: Enter's default button);
 * T4 is outside the T6 folders.
 * - <1280: edge to edge, surface + hairline top edge + the tab-bar shadow; safe-area padding below.
 *   <768 the CTA on top and the alternative under it, full width; 768–1279 the hint at the left,
 *   auto-width buttons at the right with the CTA last (rightmost).
 * - ≥1280 (docked under the aside, 400px): a card (e1 + hairline — e2 is for sheets, dialogs and
 *   popovers) on the cards' 24px inset, buttons stacked full width, CTA on top.
 * The CTA comes first in the DOM (tab order, and the form's default button for Enter); the visual
 * order is flex-direction only.
 */
export function FlowActions({ primary, secondary, hint, disabled }: FlowActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 border-t border-hairline bg-surface px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] shadow-tabbar',
        'md:flex-row md:items-center md:gap-3 md:px-6',
        'xl:flex-col xl:items-stretch xl:gap-3 xl:rounded-card xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-[var(--shadow-e1),var(--shadow-e0)]',
      )}
    >
      {hint ? <p className="t-caption text-muted md:min-w-0 md:flex-1 xl:flex-none">{hint}</p> : <span aria-hidden className="hidden md:block md:flex-1 xl:hidden" />}
      <fieldset
        disabled={disabled}
        className={cn(
          'flex min-w-0 flex-col gap-2.5 md:flex-row-reverse md:items-center xl:flex-col',
          '[&>*]:w-full md:[&>*]:w-auto xl:[&>*]:w-full',
        )}
      >
        {primary}
        {secondary}
      </fieldset>
    </div>
  );
}
