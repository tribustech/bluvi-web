'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { PartidaTabKey } from '@/core/partide';
import { cn } from '@/components/ui/cn';

/*
 * The member view's tab strip (parity partide.partida.c4; fish [id].tsx's underline strip), as
 * tabs that look like tabs (owner rule 20): one row on the white band, the selected tab in accent
 * ink over a 2px accent underline, hover and focus states, the «Jurnal» count as a badge (every
 * event, when > 0). In-page tabs, so a real ARIA tablist: ←/→ (Home/End) move between them, one tab
 * stop. The row scrolls sideways on a narrow phone; it sticks under the top bar from 768 (the band
 * that holds it), never floating (rule 3).
 */

export type StripTab = { key: PartidaTabKey; title: string; count?: number };

export const tabId = (key: string) => `partida-tab-${key}`;
export const panelId = (key: string) => `partida-panel-${key}`;

const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

export function TabStrip({ tabs, selected, onSelect }: { tabs: StripTab[]; selected: PartidaTabKey; onSelect: (key: PartidaTabKey) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(t => t.key === selected);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    const key = tabs[next].key;
    onSelect(key);
    refs.current.get(key)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Secțiunile partidei"
      onKeyDown={onKeyDown}
      data-testid="partida-tabs"
      className="flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:gap-7 md:px-6 xl:px-8 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map(tab => {
        const on = tab.key === selected;
        return (
          <button
            key={tab.key}
            ref={el => {
              if (el) refs.current.set(tab.key, el);
              else refs.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            id={tabId(tab.key)}
            aria-selected={on}
            aria-controls={panelId(tab.key)}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "relative flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 pb-2.5 t-body-strong whitespace-nowrap transition-colors duration-(--duration-fast) ease-fast after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:content-[''] focus-visible:rounded-control",
              FOCUS_RING,
              on ? 'text-accent-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink hover:after:bg-hairline',
            )}
          >
            <span>{tab.title}</span>
            {tab.count ? (
              <span
                data-testid={`partida-tab-count-${tab.key}`}
                className={cn(
                  't-micro-strong inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 tabular-nums',
                  on ? 'bg-accent-ink text-on-accent' : 'bg-soft-fill text-ink-2',
                )}
              >
                {tab.count > 99 ? '99+' : tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
