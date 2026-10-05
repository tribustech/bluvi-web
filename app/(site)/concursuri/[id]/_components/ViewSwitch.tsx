'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { LiveDot } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { VIEWS, type RankingViewKey } from './views';

/*
 * The four views (fish CompetitionRanking `chipRow`) follow the WAI-ARIA tabs pattern: each tab
 * controls the one view panel (ViewPanel), only the selected tab is in the Tab order, and
 * Left/Right/Home/End move between tabs (automatic activation, as a tap in fish). The phone chips
 * and the desktop tabs are two renderings of the same tablist; only one is displayed at a time.
 */

type Props = { value: RankingViewKey; onChange: (view: RankingViewKey) => void };

export const VIEW_PANEL_ID = 'concurs-vedere';

// Tailwind 4: `outline-none` drops the style; the ring needs `outline-solid` back (T3 DetailTabs).
const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';
const chipId = (key: RankingViewKey) => `concurs-vedere-chip-${key}`;
const tabId = (key: RankingViewKey) => `concurs-vedere-tab-${key}`;

/** Left/Right/Home/End: select the neighbour and move focus to it (in the same tablist). */
function onTabKey(e: KeyboardEvent<HTMLButtonElement>, value: RankingViewKey, onChange: Props['onChange'], idOf: (k: RankingViewKey) => string) {
  const i = VIEWS.findIndex(v => v.key === value);
  const last = VIEWS.length - 1;
  const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const key = VIEWS[next].key;
  onChange(key);
  document.getElementById(idOf(key))?.focus();
}

/**
 * fish `chipRow` (phone): four squares. Selected = accent-ink + on-accent (accent-ink, not accent:
 * the 10px label in white on accent is 4.46:1); the others soft-fill with an accent-ink icon.
 */
export function ViewChips({ value, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Vederi clasament" className="grid grid-cols-4 gap-3 md:hidden">
      {VIEWS.map(({ key, label, Icon }) => {
        const selected = key === value;
        return (
          <button
            key={key}
            id={chipId(key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={VIEW_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={e => onTabKey(e, value, onChange, chipId)}
            className={cn(
              'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card p-1.5 transition-[background-color,opacity] duration-(--duration-fast) active:opacity-80',
              FOCUS_RING,
              selected ? 'bg-accent-ink text-on-accent' : 'bg-soft-fill text-ink-2',
            )}
          >
            <Icon aria-hidden className={cn('size-6', !selected && 'text-accent-ink')} />
            <span className={cn('whitespace-nowrap', selected ? 't-micro-strong' : 't-micro text-ink')}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * From 768 (design «vederi: tab-uri mari»): the same four views as one row of tabs. From 1280 each
 * is 64px with its meta line; 768–1279 a 48px tab without it (the row of four fits, and the
 * ranking starts above the fold on a tablet).
 */
export function ViewTabs({
  value,
  onChange,
  meta,
  live,
}: Props & { meta: Record<RankingViewKey, string>; live: boolean }) {
  return (
    <div
      role="tablist"
      aria-label="Vederi clasament"
      className="hidden grid-cols-4 gap-1.5 rounded-card bg-surface p-1.5 shadow-e0 md:grid xl:gap-2"
    >
      {VIEWS.map(({ key, label, Icon }) => {
        const selected = key === value;
        return (
          <button
            key={key}
            id={tabId(key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={VIEW_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={e => onTabKey(e, value, onChange, tabId)}
            className={cn(
              'flex h-12 min-w-0 cursor-pointer items-center gap-2 rounded-control px-2.5 text-left transition-colors duration-(--duration-fast) xl:h-16 xl:gap-3 xl:rounded-card xl:px-4',
              FOCUS_RING,
              // The fill marks the selection: no elevation (e2 is for sheets and popovers, §04).
              selected ? 'bg-accent-ink text-on-accent' : 'text-ink hover:bg-soft-fill',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-control xl:size-10',
                selected ? 'bg-on-accent/15' : 'bg-accent-tint text-accent-ink',
              )}
            >
              <Icon aria-hidden className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate t-body-strong xl:t-heading">{label}</span>
              <span className={cn('truncate t-caption max-xl:sr-only', selected ? 'opacity-85' : 'text-muted')}>{meta[key]}</span>
            </span>
            {key === 'cantare' && live ? (
              <>
                <span className="sr-only">, cântar în curs</span>
                <LiveDot tone={selected ? 'on-accent' : 'live'} />
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The panel both tablists control, labelled by the selected view's tab. */
export function ViewPanel({ value, children }: { value: RankingViewKey; children: ReactNode }) {
  return (
    <div id={VIEW_PANEL_ID} role="tabpanel" aria-labelledby={chipId(value)} className="flex flex-col gap-3 md:gap-4">
      {children}
    </div>
  );
}
