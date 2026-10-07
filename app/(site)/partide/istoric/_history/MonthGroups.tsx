'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { useStackPinnedFlag } from '@/components/nav/stickyStack';
import { OwnPartidaCard } from '@/components/partide/own/OwnPartidaCard';
import { listGridClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import type { HistorySection } from './view';

/*
 * The default view (parity partide.istoric.c2): one section per month, newest first, each under a
 * sticky month label (fish stickyHeaderIndices). The label sticks under the top bar on the shell's
 * offset (UNDER_BAR_TOP: up to the top edge once the phone's bar slides away), on the page ground,
 * full bleed — attached to the top edge at every scroll position (owner rule 3). While one is stuck
 * the stack is flagged (components/nav/stickyStack), so the bar drops its shadow and the label casts
 * it: bar + label read as one header. Each month's partide auto-fill a card grid (owner rule 5:
 * more columns as the screen grows, never a stretched phone list).
 */
export function MonthGroups({ sections, now }: { sections: HistorySection[]; now: number | null }) {
  const root = useRef<HTMLDivElement>(null);
  const pinnedKey = usePinnedHeader(root);
  return (
    <div ref={root} className="flex flex-col" data-testid="history-months">
      {sections.map(s => {
        const headingId = `istoric-${s.key}`;
        const pinned = pinnedKey === s.key;
        return (
          <section key={s.key} aria-labelledby={headingId} data-testid="history-month">
            <h2
              id={headingId}
              data-month-header={s.key}
              data-pinned={pinned || undefined}
              className={cn(
                // From 1440 the summary column sits 24 to the right: the label bleeds to the left gutter only.
                'sticky z-sticky -mx-4 bg-page px-4 pt-4.5 pb-2.5 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8 2xl:mr-0 2xl:pr-0',
                UNDER_BAR_TOP,
                't-label tracking-[0.7px] text-muted',
                'transition-shadow duration-(--duration-fast) ease-fast data-pinned:shadow-e1',
              )}
            >
              <span className="ms-1">{s.title}</span>
            </h2>
            <ul className={cn(listGridClass('md'), 'pt-1 pb-2')}>
              {s.entries.map(e => (
                <li key={e.session.clientId} className="flex min-w-0 [&>*]:w-full">
                  <OwnPartidaCard session={e.session} agg={e.agg} now={now} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * The month whose label is stuck right now (its box at its own `top` and its section still under
 * it), measured on scroll / resize; flags the sticky stack while there is one. A label already
 * pushed off by the next month is not stuck (stickyStack's usePinned measures one element, and would
 * count every passed month as pinned).
 */
function usePinnedHeader(root: RefObject<HTMLDivElement | null>): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      let next: string | null = null;
      if (window.scrollY > 0) {
        for (const h of el.querySelectorAll<HTMLElement>('[data-month-header]')) {
          const top = parseFloat(getComputedStyle(h).top) || 0;
          const r = h.getBoundingClientRect();
          const section = h.parentElement?.getBoundingClientRect();
          if (r.top <= top + 0.5 && section && section.bottom > r.bottom) next = h.dataset.monthHeader ?? null;
        }
      }
      setKey(prev => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root]);
  useStackPinnedFlag(key != null);
  return key;
}
