'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { inkForFill } from './sectorInk';
import { VIEWS, type RankingViewKey } from './views';

/*
 * The four views (fish CompetitionRanking `chipRow`) follow the WAI-ARIA tabs pattern: each tab
 * controls the one view panel (ViewPanel), only the selected tab is in the Tab order, and
 * Left/Right/Home/End move between tabs (automatic activation, as a tap in fish). The phone chips
 * and the desktop tabs are two renderings of the same tablist; only one is displayed at a time.
 */

type Props = { value: RankingViewKey; onChange: (view: RankingViewKey) => void };

export const VIEW_PANEL_ID = 'concurs-vedere';
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

/** fish `chipRow` (phone): four squares, selected = filled with the view's colour. */
export function ViewChips({ value, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Vederi clasament" className="grid grid-cols-4 gap-3 md:hidden">
      {VIEWS.map(({ key, label, Icon, fill }) => {
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
              'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] p-1.5 transition-opacity active:opacity-85',
              selected ? cn(fill, inkForFill(fill)) : 'bg-soft-fill text-ink-2',
            )}
          >
            <Icon aria-hidden className="size-[22px]" />
            <span className={cn('t-micro whitespace-nowrap', selected ? 'font-bold' : 'text-ink')}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Desktop (design «vederi: tab-uri mari»): the same four views as large tabs with a meta line. */
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
      className="hidden grid-cols-2 gap-2 rounded-[18px] bg-surface p-1.5 shadow-e0 md:grid xl:grid-cols-4"
    >
      {VIEWS.map(({ key, label, Icon, fill }) => {
        const selected = key === value;
        const ink = inkForFill(fill);
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
              'flex h-16 items-center gap-3 rounded-[14px] px-4 text-left transition-colors duration-(--duration-fast)',
              selected ? cn(fill, ink, 'shadow-e2') : 'hover:bg-soft-fill',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-control',
                selected ? 'bg-on-accent/20' : cn(fill, ink),
              )}
            >
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="t-heading font-extrabold">{label}</span>
              <span className={cn('truncate t-caption', selected ? 'opacity-80' : 'text-muted')}>{meta[key]}</span>
            </span>
            {key === 'cantare' && live ? (
              <>
                <span className="sr-only">, cântar în curs</span>
                <span aria-hidden className="size-[7px] shrink-0 animate-live rounded-full bg-live" />
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
    <div id={VIEW_PANEL_ID} role="tabpanel" aria-labelledby={chipId(value)} className="flex flex-col gap-3 md:gap-4.5">
      {children}
    </div>
  );
}
