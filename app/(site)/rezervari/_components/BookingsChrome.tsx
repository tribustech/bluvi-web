'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, ClockIcon, QueueListIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { usePinned } from '@/components/nav/stickyStack';
import { filterChipClass, LIST_CHROME_H_VAR, ListTabs, type ListTab } from '@/components/templates/T1';
import {
  allowsUnfilteredView,
  MY_BUCKET_LABELS,
  MY_BUCKETS,
  MY_SUB_LABELS,
  mySubsFor,
  type MyBucket,
  type MySub,
} from '@/core/booking';
import { CHROME, PANEL_ID } from './frame';

/** fish TAB_ICONS (app/(app)/bookings/index.tsx:37-42): list, clock, check-circle, x-circle. */
const TAB_ICON: Record<MyBucket, typeof ClockIcon> = {
  all: QueueListIcon,
  pending: ClockIcon,
  confirmed: CheckCircleIcon,
  unfinished: XCircleIcon,
};

/**
 * The pinned chrome (c1–c4): the bucket tabs — the kit underline tabs (owner rule 20: one row, a
 * strong accent selected state, counts as badges), an ARIA tablist with ← → Home End — and, under
 * them, the bucket's sub-filters as a horizontal chip row (owner rule 2; fish SubFilterRow).
 *
 *  - c2 order «Toate», «În așteptare», «Confirmate», «Nefinalizate» (MY_BUCKETS) with fish's icons;
 *  - c3 only «În așteptare» carries a count, the FIRST page's pendingCount, when > 0;
 *  - c4 subs per mySubsFor, led by «Toate» (the unfiltered view) where allowsUnfilteredView.
 *
 * The tab row runs to the screen edge on the phone (the chip row's bleed) and, when it does not fit
 * (375: «Nefinalizate» is past the edge), fades the side that hides more tabs (fish SegmentedTabs'
 * edge fades); the selected tab is scrolled into view on mount and on every bucket change, so a deep
 * link, a reload or a Back return never lands on a tab the angler cannot see.
 *
 * Its height is written to LIST_CHROME_H_VAR so the docked right column sticks under it, never
 * slides beneath it; while pinned it flags the header stack (the top bar drops its shadow).
 */
export function BookingsChrome({
  bucket,
  sub,
  pendingCount,
  onBucket,
  onSub,
}: {
  bucket: MyBucket;
  sub: MySub | undefined;
  pendingCount: number;
  onBucket: (b: MyBucket) => void;
  onSub: (s: MySub | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePinned(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty(LIST_CHROME_H_VAR, `${Math.round(el.offsetHeight)}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(LIST_CHROME_H_VAR);
    };
  }, []);

  // The tab row: keep the selected tab in view, and know which edges hide tabs (the fades).
  const tabsRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });
  useEffect(() => {
    const row = tabsRef.current?.querySelector<HTMLElement>('[role="tablist"]');
    if (!row) return;
    const measure = () => {
      const max = row.scrollWidth - row.clientWidth;
      const left = max > 1 && row.scrollLeft > 1;
      const right = max > 1 && row.scrollLeft < max - 1;
      setFade((f) => (f.left === left && f.right === right ? f : { left, right }));
    };
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => {
      row.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [bucket]);
  const FADE = '24px';
  const mask =
    fade.left || fade.right
      ? `linear-gradient(to right, ${fade.left ? 'transparent' : '#000'}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${fade.right ? 'transparent' : '#000'})`
      : undefined;

  const tabs: ListTab<MyBucket>[] = MY_BUCKETS.map((key) => {
    const Icon = TAB_ICON[key];
    const count = key === 'pending' && pendingCount > 0 ? pendingCount : undefined;
    return {
      key,
      label: MY_BUCKET_LABELS[key],
      leading: <Icon aria-hidden className="size-4" strokeWidth={2} />,
      count,
      accessibleLabel: count ? `${MY_BUCKET_LABELS[key]}, ${count}` : undefined,
    };
  });

  const subs = mySubsFor(bucket);
  const chips: { key: MySub | undefined; label: string }[] =
    subs.length === 0 ? [] : [...(allowsUnfilteredView(bucket) ? [{ key: undefined, label: 'Toate' }] : []), ...subs.map((s) => ({ key: s, label: MY_SUB_LABELS[s] }))];

  return (
    <div ref={ref} data-list-chrome="" className={CHROME}>
      <div
        ref={tabsRef}
        data-testid="bookings-tabs-row"
        data-fade={mask ? [fade.left && 'left', fade.right && 'right'].filter(Boolean).join(' ') : undefined}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className="-mx-4 md:mx-0"
      >
        <ListTabs
          tabs={tabs}
          active={bucket}
          onSelect={onBucket}
          label="Rezervări"
          controls={PANEL_ID}
          className="scroll-px-4 px-4 md:scroll-px-0 md:px-0"
        />
      </div>
      {chips.length ? (
        <div
          role="group"
          aria-label={`Filtru ${MY_BUCKET_LABELS[bucket]}`}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {chips.map((c) => {
            const active = c.key === sub;
            return (
              <button
                key={c.key ?? 'toate'}
                type="button"
                aria-pressed={active}
                onClick={() => onSub(c.key)}
                className={filterChipClass({ active })}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div aria-hidden className="h-3" />
      )}
    </div>
  );
}

