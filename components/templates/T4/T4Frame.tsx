import type { ReactNode } from 'react';
import { SHELL_GUTTERS, SHELL_MAX, UNDER_BAR_TOP } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { TRACK_GAP, TRACKS } from '../tracks';

/**
 * Where the page's sticky parts start: under the site top bar (56 / 64 from 768) or at the very
 * top (a screen rendered without the shell). Every sticky T4 part takes the same value.
 */
export type T4Offset = 'shell' | 'none';

/**
 * The header band below 1280 (it scrolls away from 1280, where the rail carries the steps). On a
 * phone the top bar slides away on scroll down: the header follows it up to the edge on the bar's
 * own timing (shell UNDER_BAR_TOP), as every pinned row does.
 */
export const T4_HEADER_TOP: Record<T4Offset, string> = {
  shell: UNDER_BAR_TOP,
  none: 'top-0',
};

/**
 * The T4 page's cap is the shell's own column (SHELL_MAX, 1744): the top bar's logo, the header's
 * back button, the step list and the form share one left edge at every width. Kept as an alias
 * for screens that imported it.
 */
export const T4_MAX = SHELL_MAX;

/**
 * From 1280, the header's title column: the 40px back control + its 16px gap. A content block
 * that stands alone in the frame (a gate, an empty / error state) starts here, under the title.
 */
export const T4_TITLE_INDENT = 'xl:ml-14';

/**
 * The frame's minimum height: the viewport under the site top bar (56 / 64 from 768), so the form
 * column can push its action bar to the bottom edge on a short step.
 */
const FRAME_MIN: Record<T4Offset, string> = {
  shell: 'min-h-[calc(100dvh-var(--spacing)*14)] md:min-h-[calc(100dvh-var(--spacing)*16)]',
  none: 'min-h-dvh',
};

/** The rail and the summary column from 1280: bar (64) + the 32 the page starts with. */
const COLUMN_TOP: Record<T4Offset, string> = {
  shell: 'xl:top-24',
  none: 'xl:top-8',
};

/**
 * Column tracks from 1280 (ROADMAP §4: three columns — context left, content centre, details
 * right — filling the shell's column up to ~1680). The form track takes the rest (1fr), so the
 * summary and its CTA always end on the shell's right gutter, under the top bar's avatar. The
 * form cards fill that track (ROADMAP §4 caps only long reading text, never a form or a card
 * grid): readability lives inside the cards — T4Section field grids go md:grid-cols-2 /
 * xl:grid-cols-3, the stand grid and the day strip auto-fill more columns, long help text takes
 * PROSE_MAX — so the summary column always reads as attached to the form, no dead strip between.
 * The shared template tracks (../tracks.ts): rail 240 / 256, summary 320 / 360, 24 apart.
 */
const FRAME_TRACKS = {
  full: TRACKS.three,
  rail: TRACKS.leftMain,
  aside: TRACKS.mainRight,
  none: 'xl:grid-cols-[minmax(0,1fr)]',
} as const;

type Props = {
  /** <T4Header>: full-bleed band above the columns. */
  header: ReactNode;
  /** Left column from 1280: <T4StepList> (+ help). Below 1280 the header's <T4Progress> stands in. */
  rail?: ReactNode;
  /**
   * Right column from 1280: <T4Summary> (what is chosen so far, the price). Below 1280 it is not
   * rendered at all — the screen shows the same facts in the action bar (`meta`) and on its summary
   * step — unless `asideBelow` puts it under the form.
   */
  aside?: ReactNode;
  /** Below 1280, render the aside under the step content instead of dropping it. */
  asideBelow?: boolean;
  /**
   * <T4ActionBar>, mounted once. Below 1280 the last item of the page column, pushed to its bottom
   * (`mt-auto`) and sticky to the viewport's bottom edge. From 1280 docked under the summary in the
   * right column (T6 FlowLayout's rule), beside the total it commits to — it never floats over
   * the form. Without an aside it follows the last card of the form column, in the flow.
   */
  actions?: ReactNode;
  /** The step's data is loading (the skeleton): the form column is aria-busy. */
  busy?: boolean;
  /** The step content: <T4Section>s, notices, the error summary. */
  children: ReactNode;
  offset?: T4Offset;
  /** Accessible name of the form column (e.g. «Pasul 1: Interval și stand»). */
  label?: string;
  /**
   * The children are a page-level state (a T4Gate: error, signed out, nothing to book, gone): the
   * frame drops its rail and its summary column (`rail` / `aside` / `actions` are not rendered —
   * there is no step to track and nothing chosen to sum up; what the page is about stays in the
   * header's eyebrow) and the content spans the whole shell column, so the gate
   * (STATE_CARD_FRAME) is centred under the header at every width — never a 720 card parked left
   * of an empty band before an aside (T1, T3, T5, T6 do the same).
   */
  pageState?: boolean;
  className?: string;
};

/**
 * Focus never lands under the sticky chrome (WCAG 2.4.11): every focusable thing in the form
 * column scrolls clear of the sticky header above (top bar 56 + T4Header, 64 + header from 768;
 * from 1280 only the 64px bar, the header scrolls away) and of the sticky action bar below (it
 * is in the page flow from 1280). Overrides the 40 / 24 scroll margins of notices and the error
 * summary inside the frame (same property, more specific selector).
 */
const FOCUS_CLEAR = cn(
  '[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-48',
  'md:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-56',
  'xl:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24',
  '[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mb-32',
  'xl:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mb-8',
);

/**
 * The same clearance as the page's scroll padding while a frame is mounted: the browser treats a
 * control that is only partly under the action bar as visible, so a margin alone never scrolls it.
 * The padding shrinks the area it must fit in (focus and find-in-page alike).
 */
const PAGE_CLEAR = cn(
  '[html:has(&)]:scroll-pt-48 md:[html:has(&)]:scroll-pt-56 xl:[html:has(&)]:scroll-pt-24',
  '[html:has(&)]:scroll-pb-32 xl:[html:has(&)]:scroll-pb-8',
);

/**
 * T4 «Multi-step form» page frame (ROADMAP §4).
 * - <768: fish wizard — header (back · title · «Pasul 1 din 3» · autosave) with the segment bar,
 *   one column of cards on the page ground, the action bar pinned to the bottom edge.
 * - 768–1279: the same, with labelled segments and wider gutters.
 * - ≥1280: header band, then step list | form | summary; rail and summary stay in view (sticky),
 *   the action bar docked under the summary (the same element as below 1280: its wrappers are
 *   `display: contents` there, so there is one copy, one tab order).
 */
export function T4Frame({
  header,
  rail: railProp,
  aside: asideProp,
  asideBelow = false,
  actions: actionsProp,
  busy = false,
  children,
  offset = 'shell',
  label,
  pageState = false,
  className,
}: Props) {
  // A page-level state has no step list, no summary and no step actions (see `pageState`).
  const rail = pageState ? undefined : railProp;
  const aside = pageState ? undefined : asideProp;
  const actions = pageState ? undefined : actionsProp;
  const tracks = rail && aside ? FRAME_TRACKS.full : rail ? FRAME_TRACKS.rail : aside ? FRAME_TRACKS.aside : FRAME_TRACKS.none;
  return (
    <div className={cn('flex flex-col bg-page', FRAME_MIN[offset], PAGE_CLEAR, className)}>
      {header}
      <div
        className={cn(
          'mx-auto flex w-full flex-1 flex-col pt-4 md:pt-6 xl:grid xl:pt-8',
          TRACK_GAP,
          SHELL_MAX,
          SHELL_GUTTERS,
          tracks,
        )}
      >
        {rail ? (
          <div className="hidden xl:block">
            <div className={cn('sticky pb-8', COLUMN_TOP[offset])}>{rail}</div>
          </div>
        ) : null}
        <section
          aria-label={label}
          aria-busy={busy || undefined}
          className={cn('flex min-w-0 flex-1 flex-col', FOCUS_CLEAR)}
        >
          <div className="flex flex-col gap-4 pb-6 md:gap-5 xl:pb-8">
            {children}
            {aside && asideBelow ? <div className="xl:hidden">{aside}</div> : null}
          </div>
          {aside ? null : actions}
        </section>
        {aside ? (
          // Below 1280 both wrappers are `contents`: the aside is not rendered and the action bar is
          // an item of the page column (sticky to the viewport bottom). From 1280: the right column.
          <div className="contents xl:block xl:min-w-0">
            <div className={cn('contents xl:sticky xl:flex xl:flex-col xl:gap-4 xl:pb-8', COLUMN_TOP[offset])}>
              <div className="hidden xl:block">{aside}</div>
              {actions}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
