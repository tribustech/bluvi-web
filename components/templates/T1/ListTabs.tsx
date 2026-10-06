'use client';

import Link from 'next/link';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { PAGE_RULE } from './toolbarStyles';

export type ListTab<K extends string = string> = {
  key: K;
  label: string;
  /** Before the label: the LIVE dot (LiveDot) — the one state the app marks this way. */
  leading?: ReactNode;
  /** After the label: a count badge. Zero is never shown («Ale mele» without a number). */
  count?: number;
  /** Spoken name when the visual label is not enough («Ale mele, 2»). */
  accessibleLabel?: string;
  /**
   * Link mode: the tab is a URL (public, indexable lists). In link mode a tab WITHOUT an href is
   * shown, not linked — the «unavailable» treatment (faint, aria-disabled, the hint spoken with it).
   */
  href?: string;
  /**
   * Unavailable tab that will NOT come (a cancelled competition's Clasament): the reason, spoken; no
   * «curând» tag is shown. Without it an unlinked tab is «coming soon».
   */
  absent?: string;
};

/** How a tab is drawn: the current place, another place, or a place with no page (yet). */
export type TabLook = 'active' | 'idle' | 'unavailable';

/**
 * The underline tab row — fish CompetitionsStatusControl / PartideTabsRow: bodyStrong labels,
 * a rule under the row (PAGE_RULE: it sits on the page ground), a 2.5pt accent underline under the active one. Tabs are the places in
 * the list (Viitoare · Live · Rezultate · Ale mele), not a filter.
 *
 * Two modes:
 *  - buttons (`onSelect`): an ARIA tablist with roving focus (← → Home End), controlling the
 *    region named by `controls`;
 *  - links (every tab has `href`): a <nav> of links with aria-current, for URL-driven lists.
 *
 * The row scrolls sideways when it does not fit (five tabs at 320px), never wraps.
 */
export function ListTabs<K extends string>({
  tabs,
  active,
  onSelect,
  label,
  controls,
  unavailableHint = 'În curând pe web',
  unavailableShort = 'curând',
  className,
}: {
  tabs: ListTab<K>[];
  /** undefined: no tab is current (results mode keeps the row hidden instead). */
  active?: K;
  onSelect?: (key: K) => void;
  /** Accessible name of the row («Stare concursuri»). */
  label: string;
  /** id of the list region the tabs control (button mode). */
  controls?: string;
  /** Link mode: spoken with a tab that has no href (and no `absent`). */
  unavailableHint?: string;
  /** Link mode: shown after an unavailable tab's label. */
  unavailableShort?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const linkMode = !onSelect && tabs.some((t) => t.href);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
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
    onSelect?.(tabs[next].key);
  };

  const row = cn(
    'flex gap-6 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-7',
    PAGE_RULE,
    className,
  );

  if (linkMode) {
    return (
      <nav aria-label={label}>
        <ul className={row}>
          {tabs.map((t) => (
            <li key={t.key} className="flex shrink-0">
              {t.href ? (
                <Link
                  href={t.href}
                  aria-current={t.key === active ? 'page' : undefined}
                  aria-label={t.accessibleLabel}
                  className={tabClass(t.key === active ? 'active' : 'idle')}
                >
                  <TabContent tab={t} look={t.key === active ? 'active' : 'idle'} />
                </Link>
              ) : (
                <span aria-disabled="true" className={tabClass('unavailable')}>
                  <TabContent tab={t} look="unavailable" unavailableShort={unavailableShort} unavailableHint={unavailableHint} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // With no tab selected, the first one still takes the Tab key (roving tabindex).
  const focusIndex = Math.max(0, tabs.findIndex((t) => t.key === active));
  return (
    <div role="tablist" aria-label={label} className={row}>
      {tabs.map((t, i) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={controls ? `${controls}-tab-${t.key}` : undefined}
            aria-selected={selected}
            aria-controls={controls}
            aria-label={t.accessibleLabel}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onSelect?.(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={tabClass(selected ? 'active' : 'idle')}
          >
            <TabContent tab={t} look={selected ? 'active' : 'idle'} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tab's class list — the kit underline tab (ListTabs, T3 DetailTabs). -mb-px: the underline
 * sits ON the row's rule. The focus ring is inset so the row's overflow clip never cuts it.
 * Tailwind 4: `outline-none` sets outline-style none and `outline-2` only sets the width, so the
 * base is `outline-hidden` and the ring states `outline-solid` itself — otherwise it never draws.
 */
export function tabClass(look: TabLook) {
  return cn(
    'relative -mb-px flex min-h-11 shrink-0 items-center gap-1.5 pb-2.5 t-body-strong whitespace-nowrap outline-hidden',
    'transition-colors duration-(--duration-fast) ease-fast',
    'focus-visible:rounded-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
    look === 'active' && 'cursor-pointer text-accent-ink after:bg-accent',
    look === 'idle' && 'cursor-pointer text-muted after:bg-transparent hover:text-ink',
    look === 'unavailable' && 'cursor-not-allowed text-faint after:bg-transparent',
  );
}

/**
 * A tab's inside: leading mark, label, count pill, and — unavailable — the «curând» tag plus the
 * spoken reason. The current tab's pill is accent-ink (white 10/11px on accent is 4.47:1, under AA).
 */
export function TabContent({
  tab,
  look,
  unavailableShort = 'curând',
  unavailableHint = 'În curând pe web',
}: {
  tab: Pick<ListTab, 'label' | 'leading' | 'count' | 'accessibleLabel' | 'absent'>;
  look: TabLook;
  unavailableShort?: string;
  unavailableHint?: string;
}) {
  return (
    <>
      {tab.leading ? <span className="flex items-center pr-0.5">{tab.leading}</span> : null}
      <span>{tab.label}</span>
      {tab.count ? (
        <span
          aria-hidden={tab.accessibleLabel ? true : undefined}
          className={cn(
            't-micro-strong inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 tabular-nums',
            look === 'active' ? 'bg-accent-ink text-on-accent' : 'bg-soft-fill text-ink-2',
          )}
        >
          {tab.count > 99 ? '99+' : tab.count}
        </span>
      ) : null}
      {look === 'unavailable' ? (
        <>
          {tab.absent ? null : (
            <span aria-hidden className="t-micro text-muted">
              {unavailableShort}
            </span>
          )}
          <span className="sr-only">({tab.absent ?? unavailableHint})</span>
        </>
      ) : null}
    </>
  );
}

/** The on-air dot: shared by every template (components/templates/LiveDot), re-exported for T1's users. */
export { LiveDot } from '../LiveDot';
