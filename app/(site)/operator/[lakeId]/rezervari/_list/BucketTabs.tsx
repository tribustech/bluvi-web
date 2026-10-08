'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarIcon, ClockIcon, ListBulletIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { usePinned } from '@/components/nav/stickyStack';
import { LIST_CHROME_H_VAR, ListTabs, type ListTab } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { BUCKET_LABELS, BUCKETS, type OperatorBucket } from '@/core/booking';
import { PANEL_ID } from './frame';
import { CHROME } from './layout';

/** fish TAB_ICONS (bookings.tsx:30-36): clock, calendar, x-circle, list — recognisable before read. */
const TAB_ICON: Record<OperatorBucket, typeof ClockIcon> = {
  pending: ClockIcon,
  confirmed: CalendarIcon,
  unfinished: XCircleIcon,
  all: ListBulletIcon,
};

/**
 * The pinned chrome (c27): the bucket tabs and, under them, the sub-filter chips. Sticky under the
 * top bar (shell UNDER_BAR_TOP: it follows the phone bar to the top edge, never floats — owner rule
 * 3); its height is written to LIST_CHROME_H_VAR so the docked detail panel sticks under it; while
 * pinned it flags the header stack (the bar drops its shadow, the chrome casts it).
 */
export function InboxChrome({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = usePinned(ref);
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
  return (
    <div ref={ref} data-testid="inbox-chrome" data-pinned={pinned || undefined} className={cn(CHROME, pinned && 'shadow-e1')}>
      {children}
    </div>
  );
}

/**
 * The four buckets (c2, c3; owner rule 20: tabs that look like tabs — one row on a rule, the kit's
 * strong accent selected state with its underline, hover and focus states, the count as a badge).
 * An ARIA tablist with roving focus (← → Home End), controlling the list panel.
 *
 * The row runs to the screen edge on the phone (fish: an off-screen tab is visibly cut, not hidden),
 * scrolls sideways, and fades the edge that hides more tabs; the selected tab is scrolled into view
 * on mount and on every change, so a deep link (?status=all) never lands on a tab out of sight.
 */
export function BucketTabs({
  bucket,
  pendingCount,
  onBucket,
}: {
  bucket: OperatorBucket;
  /** c3 — the first page's meta.pendingCount, or undefined (0, first load): no badge. */
  pendingCount: number | undefined;
  onBucket: (b: OperatorBucket) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });
  useEffect(() => {
    const row = rowRef.current?.querySelector<HTMLElement>('[role="tablist"]');
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
    rowRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [bucket]);
  const FADE = '24px';
  const mask =
    fade.left || fade.right
      ? `linear-gradient(to right, ${fade.left ? 'transparent' : '#000'}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${fade.right ? 'transparent' : '#000'})`
      : undefined;

  const tabs: ListTab<OperatorBucket>[] = BUCKETS.map((key) => {
    const Icon = TAB_ICON[key];
    const count = key === 'pending' ? pendingCount : undefined;
    return {
      key,
      label: BUCKET_LABELS[key],
      leading: <Icon aria-hidden className="size-4" strokeWidth={2} />,
      count,
      accessibleLabel: count ? `${BUCKET_LABELS[key]}, ${count}` : undefined,
    };
  });

  return (
    <div
      ref={rowRef}
      data-testid="inbox-tabs-row"
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
  );
}
