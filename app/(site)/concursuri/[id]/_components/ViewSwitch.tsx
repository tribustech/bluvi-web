'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { LiveDot } from '@/components/templates/LiveDot';
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
 * From 768: the same four views as a sub-level control under the route tabs (DetailTabs) — the kit
 * Segmented look (forms/SegmentedControl): a soft-fill track, the selected view a surface thumb, and
 * only its icon takes the accent. The solid accent stays for primary actions, so the ranking, not
 * this switch, is the loudest thing below the header. From 1280 each tab carries its meta line;
 * 768–1279 it is a 44px tab without it.
 */
export function ViewTabs({
  value,
  onChange,
  meta,
  live,
}: Props & { meta: Record<RankingViewKey, string>; live: boolean }) {
  return (
    <div role="tablist" aria-label="Vederi clasament" className="hidden grid-cols-4 gap-1 rounded-card bg-soft-fill p-1 md:grid">
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
              'flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-[calc(var(--radius-card)-4px)] px-2.5 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select xl:h-14 xl:justify-start xl:gap-3 xl:px-4',
              FOCUS_RING,
              selected ? 'bg-surface text-ink shadow-e1' : 'text-ink-2 hover:text-ink',
            )}
          >
            <Icon aria-hidden className={cn('size-5 shrink-0 xl:size-6', selected ? 'text-accent-ink' : 'text-ink-2')} />
            <span className="flex min-w-0 flex-col text-left">
              <span className="truncate t-body-strong">{label}</span>
              <span className="truncate t-caption text-muted max-xl:sr-only">{meta[key]}</span>
            </span>
            {key === 'cantare' && live ? (
              <>
                <span className="sr-only">, cântar în curs</span>
                <LiveDot tone="live" />
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
