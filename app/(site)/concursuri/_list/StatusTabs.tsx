'use client';

import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { TabContent, type ListTab } from '@/components/templates/T1/ListTabs';
import { cn } from '@/components/ui/cn';

/*
 * The status switcher of /concursuri (Viitoare · Live · Rezultate · Ale mele) as a tab bar that
 * reads as one (ROADMAP §4b.20, «nici nu vezi că sunt taburi»): one container on the page ground,
 * the selected tab filled (accent tint) with the accent underline under its label, a hover wash on
 * the others, a keyboard ring, and the counts as badges. Same ARIA as the kit's ListTabs button mode
 * (tablist, roving focus with ← → Home End, aria-controls), so every path and test keeps working.
 * Badges: TabContent's (zero never shown); a count the caller does not know is simply not passed.
 *
 * Each tab with an `href` is a real link (role tab): crawlers, a middle click, «open in new tab» and a
 * page without JS follow it to the tab's own page (/concursuri/live). With `onSelect` a plain click
 * stays on the page and switches the list in place (no server round trip; the list mirrors its
 * path itself). Without `onSelect` (the page's loading frame) the links simply navigate.
 */

export function StatusTabs<K extends string>({
  tabs,
  active,
  onSelect,
  label,
  controls,
  className,
}: {
  tabs: ListTab<K>[];
  /** undefined: no tab is current (Ale mele off the status tabs keeps none selected). */
  active?: K;
  /** Switch in place; left out, a tab's link navigates. */
  onSelect?: (key: K) => void;
  /** Accessible name of the row («Stare concursuri»). */
  label: string;
  /** id of the list region the tabs control. */
  controls?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    if (!onSelect) return;
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(tabs[next].key);
  };
  // A plain primary click switches in place; a modified one (new tab, window) is the link's.
  const onClick = (e: MouseEvent<HTMLElement>, key: K) => {
    if (!onSelect) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(key);
  };
  // With no tab selected, the first one still takes the Tab key (roving tabindex).
  const focusIndex = Math.max(0, tabs.findIndex((t) => t.key === active));

  return (
    <div className={cn('flex pb-1', className)}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          // The track: a surface with a hairline on the page ground (soft-fill would vanish on it).
          'flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface p-1 shadow-e0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {tabs.map((t, i) => {
          const selected = t.key === active;
          const Tag = t.href ? 'a' : 'button';
          return (
            <Tag
              key={t.key}
              ref={(el: HTMLElement | null) => {
                refs.current[i] = el;
              }}
              {...(t.href ? { href: t.href } : { type: 'button' as const })}
              role="tab"
              id={controls ? `${controls}-tab-${t.key}` : undefined}
              aria-selected={selected}
              aria-controls={controls}
              aria-label={t.accessibleLabel}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={(e: MouseEvent<HTMLElement>) => onClick(e, t.key)}
              onKeyDown={(e: KeyboardEvent<HTMLElement>) => onKeyDown(e, i)}
              className={cn(
                'relative flex h-10 shrink-0 xl:h-9 cursor-pointer items-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] px-3.5 t-body-strong whitespace-nowrap outline-hidden md:px-4',
                'transition-colors duration-(--duration-fast) ease-fast',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                // The underline: the kit tab's accent bar, inside the filled tab.
                "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:content-['']",
                selected ? 'bg-accent-tint text-accent-ink after:bg-accent' : 'text-muted after:bg-transparent hover:bg-soft-fill hover:text-ink',
              )}
            >
              <TabContent tab={t} look={selected ? 'active' : 'idle'} />
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
