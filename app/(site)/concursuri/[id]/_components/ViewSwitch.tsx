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

/** A view's count, shown as a badge on its tab («24»), spoken in full («24 de pescari»). */
export type ViewBadge = { value: string; label: string };
type Badges = Partial<Record<RankingViewKey, ViewBadge>>;

/**
 * The count badge (owner rule 20): a pill on the tab. On the selected (filled) tab it inverts —
 * the on-accent pill with the accent-ink figure — so it stays a badge, not loose text.
 */
/** The badge's figure, capped at «999+» (a 1.284-catch count would not fit an 81px phone chip); the label keeps the full count. */
export function badgeFigure(value: string): string {
  const n = Number(value.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 999 ? '999+' : value;
}

function CountBadge({ badge, selected, className }: { badge: ViewBadge; selected: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 t-micro-strong whitespace-nowrap tabular-nums',
        selected ? 'bg-on-accent text-accent-ink' : 'bg-accent-tint-2 text-accent-ink',
        className,
      )}
    >
      <span aria-hidden>{badgeFigure(badge.value)}</span>
      <span className="sr-only">{`, ${badge.label}`}</span>
    </span>
  );
}

/**
 * Owner rule 20 (ROADMAP §4b, «nici nu vezi că sunt taburi»): the four views read as tabs — one
 * container, a strong selected state, hover and focus, the counts as badges.
 *
 * Phone (fish `chipRow`): one track holding the four tabs, icon over label. The track has the same
 * visible edge as the desktop control (a surface track, the handle-grey border, the e1 lift): a
 * soft-fill track on the white phone ground was ~1.08:1, so only the filled chip read as a control.
 * The selected one is filled accent-ink with on-accent text (accent-ink, not accent: a 10px label in
 * white on accent is 4.46:1); the others take the accent tint on hover. The badge is drawn on the
 * icon's corner, pushed left when it is wide so it never leaves its chip (a flex spacer that shrinks).
 */
export function ViewChips({ value, onChange, badges = {} }: Props & { badges?: Badges }) {
  return (
    <div role="tablist" aria-label="Vederi clasament" className="grid grid-cols-4 gap-1 rounded-card border border-handle bg-surface p-1 shadow-e1 md:hidden">
      {VIEWS.map(({ key, label, Icon }) => {
        const selected = key === value;
        const badge = badges[key];
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
              'relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-card)-4px)] px-1 py-2.5 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select active:opacity-80',
              FOCUS_RING,
              selected ? 'bg-accent-ink text-on-accent shadow-e1' : 'text-ink-2 hover:bg-accent-tint hover:text-accent-ink',
            )}
          >
            <Icon aria-hidden className={cn('size-6', !selected && 'text-accent-ink')} />
            <span className={cn('max-w-full truncate', selected ? 't-micro-strong' : 't-micro text-ink')}>{label}</span>
            {/* After the label in the DOM (the tab's name starts with the view), drawn on the icon's
                corner: the spacer (50% + 6px of the 4px-inset row) puts it at the chip's 50% + 6px,
                and shrinks when the badge is wider than the room left, so it never leaves the chip. */}
            {badge ? (
              <span className="pointer-events-none absolute inset-x-1 top-1.5 flex">
                <span aria-hidden className="min-w-0 shrink basis-[calc(50%+--spacing(1.5))]" />
                <CountBadge badge={badge} selected={selected} className="max-w-full" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * From 768: the same four views as a segmented control under the route tabs (DetailTabs).
 * Owner rule 20 («nici nu vezi că sunt taburi»): the container must have a visible edge on the grey
 * page — a surface track with a handle-grey (gray-300) border and the e1 lift, not the hairline ring
 * (#EFF1F5 is lighter than the page #F4F5FA, so the old card had no edge). The selected view is a
 * filled accent-ink tab with on-accent text; the others are ink with an accent-ink icon and take the
 * accent tint on hover. Rule 16 (compact, never stretched): the control is content-sized and
 * left-aligned — four auto columns, each tab its label's width plus padding, not a quarter of 1920.
 * Each count is a badge after the label; Cântare carries the live dot while a weighing is in progress.
 */
export function ViewTabs({ value, onChange, badges = {}, live }: Props & { badges?: Badges; live: boolean }) {
  return (
    <div role="tablist" aria-label="Vederi clasament" className="hidden w-fit max-w-full grid-cols-[repeat(4,auto)] gap-1 self-start rounded-card border border-handle bg-surface p-1 shadow-e1 md:grid">
      {VIEWS.map(({ key, label, Icon }) => {
        const selected = key === value;
        const badge = badges[key];
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
              'flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-[calc(var(--radius-card)-5px)] px-3.5 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select lg:min-w-36 xl:gap-2.5 xl:px-5',
              FOCUS_RING,
              selected ? 'bg-accent-ink text-on-accent shadow-e1' : 'text-ink hover:bg-accent-tint hover:text-accent-ink',
            )}
          >
            <Icon aria-hidden className={cn('size-5 shrink-0', selected ? 'text-on-accent' : 'text-accent-ink')} />
            <span className="truncate t-body-strong">{label}</span>
            {badge ? <CountBadge badge={badge} selected={selected} /> : null}
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
