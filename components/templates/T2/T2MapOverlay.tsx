'use client';

import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';

/*
 * Things that float over the T2 map: status pills (fish «Se încarcă…») and the selected item's
 * card (fish LakeMapPinCard).
 */

/**
 * A status centred over the map («Se încarcă…», «Bălțile nu s-au încărcat»): the kit StatusPill
 * (info while loading, warning when a read failed) on an opaque surface with the floating e2
 * shadow, so its tint never shows the map through it. Visual and silent — T2Layout's one live
 * region (`announcement`) speaks the state, so the pill, the header and the skeleton do not talk
 * over each other. Statuses only (Fundații: radius 999 is a state pill); an action over the map is
 * a kit Button (T2_FLOATING_BUTTON).
 * TODO(kit): StatusPill `floating` (and a `danger` tone) — this task may only touch T2.
 */
export function T2MapPill({
  children,
  tone = 'info',
  busy = false,
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'neutral';
  /** Shows the spinner (loading after a pan / zoom). */
  busy?: boolean;
}) {
  return (
    <span aria-hidden className="flex rounded-full bg-surface shadow-e2">
      <StatusPill tone={tone}>
        {busy ? <T2Spinner className="size-3.5" /> : null}
        {children}
      </StatusPill>
    </span>
  );
}

/**
 * The busy glyph every template uses (T4Status, T5 DashboardRefresh, TopBar): the 24-outline
 * ArrowPathIcon turning; still under prefers-reduced-motion (Fundații §06).
 */
export function T2Spinner({ className }: { className: string }) {
  return <ArrowPathIcon aria-hidden className={cn('shrink-0 animate-spin motion-reduce:animate-none', className)} />;
}

/**
 * A kit Button floating over the map («Șterge filtre», «Vezi lista»): its own radius and size, an
 * opaque ground and the e2 shadow. `!` on the shadow only: cn() does not merge and the primary
 * carries shadow-button. TODO(kit): Button `floating` prop.
 */
export const T2_FLOATING_BUTTON = 'shadow-e2!';

/**
 * Where focus goes when the pin card of `id` closes and its opener is gone (a pin drawn out of a
 * cluster, a card opened from code): the item's link in the list when it is on screen (≥768), else
 * the item's pin, else the map canvas.
 */
export function t2FocusTarget(id: string): HTMLElement | null {
  const visible = (el: HTMLElement | null) => (el && el.getClientRects().length > 0 && !el.closest('[inert]') ? el : null);
  return (
    visible(document.querySelector<HTMLElement>(`[data-t2-id="${CSS.escape(id)}"] a`)) ??
    visible(document.querySelector<HTMLElement>(`[data-t2-pin="${CSS.escape(id)}"]`)) ??
    visible(document.querySelector<HTMLElement>('.maplibregl-canvas'))
  );
}

/**
 * The selected item over the map, built like the kit card of the same item (LakeCard): the title
 * row carries `titleAside` on the right (the rating), then the caption line(s) and the signature
 * number, with the card's 12px padding and 6px rhythm. The title is the link (stretched over the
 * card, like the kit cards); `actions` («Direcții») sit on the baseline of the last line and stay
 * their own targets above the link. Escape closes; on open, focus moves
 * to the card so a keyboard user lands on what the pin opened; on close it goes back to the
 * opener, or to `returnFocusTo()` when the opener is gone.
 */
export function T2MapCard({
  title,
  href,
  media,
  titleAside,
  meta,
  stat,
  actions,
  onClose,
  returnFocusTo,
  closeLabel = 'Închide',
}: {
  title: string;
  href: string;
  /** Photo strip (fish: up to 3 photos; the list card's 132px band), with the card's photo pills («Rezervare online»). */
  media?: ReactNode;
  /** Right end of the title row, as on the list card (the rating). */
  titleAside?: ReactNode;
  /** The caption line: place, distance… */
  meta?: ReactNode;
  /** The signature number, as on the list card (PriceFrom: the number + its own unit). */
  stat?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  /** Fallback focus target on close when the opener no longer exists (see t2FocusTarget). */
  returnFocusTo?: () => HTMLElement | null;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const fallback = useRef(returnFocusTo);
  useEffect(() => {
    fallback.current = returnFocusTo;
  });
  // Closing hands focus back to what opened the card (the pin), or to the fallback.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const opener = active && active !== document.body ? active : null;
    const card = ref.current;
    return () => {
      const now = document.activeElement;
      const lost = !now || now === document.body || !!card?.contains(now);
      if (!lost) return;
      const target = opener?.isConnected && !card?.contains(opener) ? opener : fallback.current?.();
      target?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={cn(
        'relative overflow-hidden rounded-card bg-surface shadow-e2 outline-none',
        'translate-y-0 opacity-100 transition-[translate,opacity] duration-(--duration-medium) ease-medium starting:translate-y-4 starting:opacity-0',
      )}
    >
      {media ? <div className="relative">{media}</div> : null}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute top-2 right-2 z-above flex size-9 cursor-pointer items-center justify-center rounded-full bg-photo-scrim text-on-photo-scrim transition-opacity duration-(--duration-fast) hover:opacity-90 active:opacity-80"
      >
        <XMarkIcon aria-hidden className="size-5" />
      </button>
      <div className="flex items-end gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Baseline, not top: the rating's numerals sit on the title's line, not above it. */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 t-heading text-ink">
              <Link
                href={href}
                className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
              >
                {title}
              </Link>
            </h3>
            {titleAside}
          </div>
          {meta ? <div className="flex flex-col gap-0.5 t-caption text-muted">{meta}</div> : null}
          {stat ? <div className="pt-0.5">{stat}</div> : null}
        </div>
        {actions ? <div className="relative z-above flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </article>
  );
}
