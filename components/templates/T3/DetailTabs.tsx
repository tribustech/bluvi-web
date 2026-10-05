'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * T3 route tabs — extracted from the competition page (fish ROUTES_LIST: Clasament · Informații ·
 * Participanți · Extra Cântare · Regulament). Each tab is its own URL, so these are links in a
 * <nav>, with `aria-current="page"` on the current one — a Link like the others, as ListTabs'
 * link mode renders it (not an ARIA tablist: activating one navigates). A tab without a web page
 * yet is shown, not linked: the T3 «unavailable» treatment (text-muted, aria-disabled, the hint
 * «În curând pe web» spoken with it), the same one quick actions and section actions use.
 *
 * The look is the kit underline tab row (T1 ListTabs `tabClass` + `TabContent`), spec for spec:
 * bodyStrong labels, muted → ink on hover, the current one accent-ink over a 2px rounded accent
 * underline, 24 / 28px between labels, the count as a small pill (the current one on accent-ink:
 * white 10/11px on accent is 4.47:1, under AA), an inset focus ring.
 * TODO(kit, T1 owner): ListTabs cannot render this strip yet (link mode needs every tab to have an
 * href, and `tabClass` / `TabContent` are private). Give ListTabs an unavailable tab (no href →
 * aria-disabled + hint), export tabClass / TabContent, move its active count pill to
 * `bg-accent-ink`, then make this a thin wrapper that only adds the band gutters.
 *
 * Gutters: the first label sits on the shell gutter (16 / 24 / 32), like the title above it — the
 * gutter is the scroller's own padding, so the scroll area runs to the screen edge and the next
 * label is cut AT the edge (a visible «more»), not at the gutter. Sits at the bottom of
 * <DetailBand>, whose hairline is the strip's baseline. On the phone the strip scrolls sideways;
 * each edge fades while there is more to scroll that way, and on load the current tab is brought
 * into view with part of the next one showing.
 */

export type DetailTab = {
  label: string;
  /** Omit for a tab that has no web page yet: shown, not linked. The current tab links to itself. */
  href?: string;
  current?: boolean;
  /** Small count after the label («Participanți 48»). Zero and undefined are not shown. */
  count?: number;
  /**
   * A tab with no href that will NOT come (a cancelled competition's Clasament): why, spoken — no
   * «curând» tag is shown (the page's status says it). Without it, an unlinked tab is «coming soon».
   */
  absent?: string;
};

// Tailwind 4: `outline-none` sets outline-style none, and `outline-2` only sets the width — the
// focus ring needs `outline-solid` back, or it never draws.
const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

const TAB =
  'relative flex min-h-11 shrink-0 items-center gap-1.5 pb-2.5 t-body-strong whitespace-nowrap ' +
  'transition-colors duration-(--duration-fast) ease-fast focus-visible:rounded-control ' +
  FOCUS_RING +
  ' ' +
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']";

/** The edge fades: the first / last 24px of the strip dissolve while it can still scroll that way. */
const FADE = {
  end: '[mask-image:linear-gradient(to_right,black_calc(100%-(--spacing(6))),transparent)]',
  start: '[mask-image:linear-gradient(to_right,transparent,black_--spacing(6))]',
  both: '[mask-image:linear-gradient(to_right,transparent,black_--spacing(6),black_calc(100%-(--spacing(6))),transparent)]',
} as const;

/** How much of the next tab shows once the current one is scrolled into view (its gap + ~48px). */
const PEEK = 72;

export function DetailTabs({
  label,
  tabs,
  unavailableHint = 'În curând pe web',
  unavailableShort = 'curând',
  className,
}: {
  label: string;
  tabs: DetailTab[];
  /** Spoken with an unavailable tab. */
  unavailableHint?: string;
  /** Shown after an unavailable tab's label. */
  unavailableShort?: string;
  className?: string;
}) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const someUnlinked = tabs.some(t => !t.href);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const check = () => {
      setMore(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
      setScrolled(row.scrollLeft > 1);
    };
    // The current tab in view, with the start of the next one showing (when the row overflows).
    const current = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && row.scrollWidth > row.clientWidth) {
      const left = current.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
      const right = left + current.offsetWidth;
      const padStart = parseFloat(getComputedStyle(row).paddingLeft) || 0;
      if (right + PEEK > row.clientWidth) row.scrollLeft = Math.min(left - padStart, right + PEEK - row.clientWidth);
    }
    check();
    row.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(row);
    return () => {
      row.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return (
    // z-above: the current tab's underline paints over the band's full-bleed hairline it sits on.
    <nav aria-label={label} data-t3="tabs" className={cn('relative z-above', className)}>
      {/* Focusable when some tabs are not links, so a keyboard can still scroll it (axe scrollable-region-focusable). */}
      <ul
        ref={rowRef}
        tabIndex={someUnlinked ? 0 : undefined}
        className={cn(
          'flex scroll-px-4 gap-6 overflow-x-auto rounded-control px-4 [scrollbar-width:none] md:scroll-px-6 md:gap-7 md:px-6 xl:scroll-px-8 xl:px-8 [&::-webkit-scrollbar]:hidden',
          FOCUS_RING,
          more && scrolled ? FADE.both : more ? FADE.end : scrolled ? FADE.start : null,
        )}
      >
        {tabs.map(tab => {
          const content = (
            <>
              <span>{tab.label}</span>
              {tab.count ? (
                <span
                  className={cn(
                    't-micro-strong inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 tabular-nums',
                    tab.current ? 'bg-accent-ink text-on-accent' : 'bg-soft-fill text-ink-2',
                  )}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={tab.label} className="flex shrink-0">
              {tab.href ? (
                <Link
                  href={tab.href}
                  aria-current={tab.current ? 'page' : undefined}
                  className={cn(TAB, 'cursor-pointer', tab.current ? 'text-accent-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink')}
                >
                  {content}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(TAB, 'cursor-not-allowed text-faint after:bg-transparent')}>
                  {content}
                  {tab.absent ? null : (
                    <span aria-hidden className="t-micro text-muted">
                      {unavailableShort}
                    </span>
                  )}
                  <span className="sr-only">({tab.absent ?? unavailableHint})</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
