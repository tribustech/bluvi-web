'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { isMedalPlace, MEDAL } from '@/components/ranking';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fmtKg, isWeighed, type StatsPeriod, type TopAngler } from '@/core/partide';
import { anglerHref } from '@/lib/routes';
import { PERIOD_PHRASE } from './place';

/*
 * Owner rule 17 on «Clasamente»: from 1024 a press on a ranked angler (a podium place, a table row)
 * opens a popover anchored to it — avatar, name, place, the period's figures (partide, capturi, kg,
 * the unit apart: rule 10) and «Vezi profilul» → /pescari/[id] (public). Below 1024 the same press
 * follows the link to the profile (fish openAngler). The links are real links in the HTML at every
 * width: the popover only takes the click over once the screen is wide (usePopoverEnabled).
 *
 * Keyboard: focus moves into the popover and is trapped there (Tab / Shift+Tab cycle); Escape or
 * «Închide» closes it and focus goes back to the link that opened it; a press outside closes it. It
 * lives in the top layer (popover="manual") and follows its anchor on scroll and resize. Placement:
 * under the anchor, over it when there is no room below, kept inside the viewport.
 * The competition page's PersonPopover is the same idea for registrations (stats from another
 * endpoint); this one carries the ranking row's own figures, no read.
 */

export const POPOVER_MIN_WIDTH = 1024;
const QUERY = `(min-width: ${POPOVER_MIN_WIDTH}px)`;

/** ≥1024 (false on the server and until hydrated: the phone's behaviour, a link). */
export function usePopoverEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export type PopoverTarget = { angler: TopAngler; rank: number; anchor: HTMLElement; opener: HTMLElement };

export function useAnglerPopover() {
  const [target, setTarget] = useState<PopoverTarget | null>(null);
  const open = useCallback((angler: TopAngler, rank: number, anchor: HTMLElement, opener: HTMLElement) => {
    setTarget((cur) => (cur && cur.angler.uid === angler.uid && cur.anchor === anchor ? null : { angler, rank, anchor, opener }));
  }, []);
  const close = useCallback(() => setTarget(null), []);
  return { target, open, close };
}

export type OpenAngler = (angler: TopAngler, rank: number, anchor: HTMLElement, opener: HTMLElement) => void;

/**
 * An angler as a link to the profile; from 1024 its click opens the popover instead (`onOpen`),
 * anchored to the closest `[data-popover-anchor]` (the table row, the podium column).
 */
export function AnglerLink({
  angler,
  rank,
  onOpen,
  popover,
  label,
  className,
  children,
  rowLink = false,
}: {
  angler: TopAngler;
  rank: number;
  onOpen: OpenAngler;
  popover: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
  /** The row's main link (table.tsx rowClick presses it). */
  rowLink?: boolean;
}) {
  const href = anglerHref(angler.uid);
  if (!href) return <span className={className}>{children}</span>;
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!popover || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const anchor = e.currentTarget.closest<HTMLElement>('[data-popover-anchor]') ?? e.currentTarget;
    onOpen(angler, rank, anchor, e.currentTarget);
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      aria-haspopup={popover ? 'dialog' : undefined}
      data-row-link={rowLink ? '' : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

const GAP = 8;
const EDGE = 12;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function placement(anchor: HTMLElement, el: HTMLElement) {
  const a = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const left = Math.max(EDGE, Math.min(a.left + Math.min(24, a.width / 4), vw - w - EDGE));
  if (vh - a.bottom - GAP - EDGE >= h) return { top: a.bottom + GAP, left, above: false };
  if (a.top - GAP - h >= EDGE) return { top: a.top - GAP - h, left, above: true };
  return { top: Math.max(EDGE, Math.min(a.bottom + GAP, vh - h - EDGE)), left, above: false };
}

export function AnglerPopover({ target, period, onClose }: { target: PopoverTarget | null; period: StatsPeriod; onClose: () => void }) {
  if (!target) return null;
  return <Popover key={`${target.angler.uid}:${target.rank}`} target={target} period={period} onClose={onClose} />;
}

function Popover({ target, period, onClose }: { target: PopoverTarget; period: StatsPeriod; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const { angler: a, rank, anchor, opener } = target;
  const name = a.name ?? 'Pescar';
  const href = anglerHref(a.uid);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = placement(anchor, el);
    setPos((p) => (p && p.top === next.top && p.left === next.left && p.above === next.above ? p : next));
  }, [anchor]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPopover();
    } catch {
      /* no popover support: still fixed-positioned */
    }
    place();
    return () => {
      try {
        el.hidePopover();
      } catch {
        /* gone */
      }
    };
  }, [place]);

  const placed = pos !== null;
  useLayoutEffect(() => {
    if (!placed) return;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({ preventScroll: true });
  }, [placed]);

  useEffect(() => {
    const onMove = () => {
      if (!anchor.isConnected) return onClose();
      place();
    };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (ref.current?.contains(n) || anchor.contains(n)) return;
      onClose();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchor, onClose, place]);

  const closeAndReturn = () => {
    onClose();
    if (opener.isConnected) opener.focus({ preventScroll: true });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeAndReturn();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!items.length) return e.preventDefault();
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const figures: { label: string; value: string; unit?: string }[] = [
    { label: a.partide === 1 ? 'Partidă' : 'Partide', value: a.partide.toLocaleString('ro-RO') },
    { label: a.catches === 1 ? 'Captură' : 'Capturi', value: a.catches.toLocaleString('ro-RO') },
    isWeighed(a.totalKg) ? { label: 'Total', value: fmtKg(a.totalKg), unit: 'kg' } : { label: 'Total', value: '—' },
  ];

  return createPortal(
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-angler-popover
      onKeyDown={onKeyDown}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      className={cn(
        'fixed m-0 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-card border-0 bg-surface p-0 text-ink shadow-e2 outline-none',
        'opacity-100 transition-[opacity,translate] duration-(--duration-fast) ease-fast starting:opacity-0 motion-reduce:transition-none',
        pos?.above ? 'starting:translate-y-1' : 'starting:-translate-y-1',
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Avatar name={name} src={a.avatarUrl} size={48} tone="solid" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={titleId} className="line-clamp-2 t-heading text-ink">
            {name}
          </h2>
          <p className="flex items-center gap-2 t-caption text-ink-2">
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 t-micro-strong tabular-nums',
                isMedalPlace(rank) ? MEDAL[rank] : 'bg-soft-fill text-ink-2',
              )}
            >
              {rank}
            </span>
            Locul {rank} {PERIOD_PHRASE[period]}
          </p>
        </div>
        <button
          type="button"
          onClick={closeAndReturn}
          aria-label="Închide"
          className="-mt-1 -mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </header>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <dl className="grid grid-cols-3 gap-1.5">
          {figures.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col rounded-control bg-page px-3 py-2">
              <dt className="t-micro text-muted">{f.label}</dt>
              <dd className="truncate t-body-strong text-ink tabular-nums">
                {f.value}
                {f.unit ? <span className="ml-1 t-micro text-muted">{f.unit}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
        {href ? (
          <ButtonLink href={href} variant="primary" size="compact" block data-autofocus="" iconRight={<ArrowRightIcon aria-hidden />}>
            Vezi profilul
          </ButtonLink>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
