import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { iconButtonClass } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';
import { FOCUS_RING, PAGE_RULE, pageToolClass } from './toolbarStyles';

export type ListBack = { label: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/**
 * The kit icon button (48 / 40 from 1280). T4Header's back square is soft-fill because it sits on a
 * surface; this header sits on the PAGE ground, where soft-fill (#f2f4f7 on #f4f5fa) vanishes and
 * leaves a bare arrow — so it rests on surface + hairline, like the toolbar's FilterButton.
 */
const BACK = iconButtonClass({
  className:
    cn('bg-surface shadow-e0 hover:bg-soft-fill', FOCUS_RING),
});

/**
 * A two-state tool in the header's action slot (fish: the eye for «Urmărite»). The page-ground look
 * of the toolbar (pageToolClass: surface + hairline at rest, accent tint + ink when pressed) — never
 * a bare ghost, whose soft-fill hover vanishes on the page ground. A 48 icon square below 768, the
 * labelled tool from 768; the label is the name at every width (sr-only on the phone).
 */
export function ListHeaderToggle({
  label,
  icon,
  pressed,
  onToggle,
  className,
}: {
  label: string;
  /** A 24 outline Heroicon (24 in the phone square, the kit's 20 slot beside the label). */
  icon: ReactNode;
  pressed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onToggle} className={cn(pageToolClass({ pressed }), className)}>
      {icon}
      <span className="sr-only md:not-sr-only">{label}</span>
    </button>
  );
}

/**
 * The list's title block. Two modes, as in fish:
 *  - browse: the section title («Concursuri», page-title at every width: 28 → 32) with the page's
 *    tools on the right (fish: the eye for «Urmărite»; desktop adds labelled actions such as
 *    «Creează concurs»);
 *  - results: a committed search or filter takes the screen over (fish CompetitionResultsChrome):
 *    a back square leads, the title says what was asked («Rezultate pentru „Chita”», title1).
 *
 * The h1 is the page's only one. `description` is a caption line under it (count, scope);
 * `below` holds the ListTabs row, which shares the header's bottom rule (PAGE_RULE: the page-ground
 * divider — the white-surface hairline is invisible on the page ground).
 */
export function ListHeader({
  title,
  description,
  back,
  actions,
  below,
  reserveBelow = false,
  reserveEnd,
  titleId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: ListBack;
  /** Icon buttons / buttons on the right of the title row. */
  actions?: ReactNode;
  /** ListTabs (or nothing in results mode). */
  below?: ReactNode;
  /**
   * From 1280, with no `below`: keep the tab row's height and rule, so entering results mode from
   * the live-apply filter column does not pull the column up under the pointer. Pass the answer
   * (the results count, «Se caută…», «Niciun rezultat») to FILL the band — never an empty 44px
   * strip; it is aria-hidden (the list's own heading or live region says it), so pass what the
   * page already speaks.
   */
  reserveBelow?: boolean | ReactNode;
  /**
   * The band's right end (from 1280, with `reserveBelow`): a live control that would otherwise take
   * a row of its own over the list — the ViewToggle. NOT aria-hidden. The caller hides its other
   * instance from 1280 (ListSummary hides `end` together with a `titleHiddenFrom="xl"` title).
   */
  reserveEnd?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col', className)}>
      <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
        {back ? (
          back.href ? (
            <Link href={back.href} aria-label={back.label} className={BACK}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={back.onClick} aria-label={back.label} className={BACK}>
              <ArrowLeftIcon aria-hidden />
            </button>
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 id={titleId} tabIndex={-1} className={cn(back ? 't-title1' : 't-page-title', 'text-ink outline-none')}>
            {title}
          </h1>
          {description ? <div className="t-caption mt-0.5 text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {below ? (
        <div className="mt-3 xl:mt-4">{below}</div>
      ) : reserveBelow ? (
        // The control sits 3px above the rule (mb-0.75), so a 40px toggle fits the 44px band exactly.
        <div className={cn('mt-4 hidden min-h-11 items-end gap-3 border-b xl:flex', PAGE_RULE)}>
          <span aria-hidden className="min-w-0 flex-1 truncate pb-2.5 t-body-strong text-ink-2">
            {reserveBelow === true ? null : reserveBelow}
          </span>
          {reserveEnd ? <div className="mb-0.75 flex shrink-0 items-center">{reserveEnd}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
