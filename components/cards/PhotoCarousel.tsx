'use client';

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';

/**
 * Airbnb's listing photos (owner 2026-10-12): the card's photos side by side in one scroll-snap
 * track — a swipe on touch, «‹ ›» on hover with a mouse, dots under them for where you are. Every
 * photo is a link to the card's page (the card's own stretched link sits under this frame, so the
 * frame is lifted above it), the arrows are buttons of their own. One photo: no arrows, no dots.
 *
 * `slides` are the photos themselves (each an <Image fill>), built by the card so it keeps its own
 * `sizes` and LCP rules for the first one; the rest load lazily as the track brings them near.
 */
export const MAX_PHOTOS = 5;

export function PhotoCarousel({
  slides,
  href,
  label,
  className,
  children,
}: {
  slides: ReactNode[];
  href: string;
  /** The card's name, for the arrows («Poza următoare, Lacul X»). */
  label: string;
  /** The frame: its aspect or height and its corners. */
  className?: string;
  /** Overlays on the photos (pills, badges), above the track. */
  children?: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const shown = slides.slice(0, MAX_PHOTOS);
  const many = shown.length > 1;

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const go = (e: MouseEvent<HTMLButtonElement>, step: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: (index + step) * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <div className={cn('group/photos relative isolate z-above overflow-hidden bg-soft-fill', className)}>
      <div
        ref={track}
        onScroll={many ? onScroll : undefined}
        // A mouse moves the track with the arrows (it scrolls from code only, so it is not a scrollable
        // region to tab into); a touch screen swipes it.
        className="flex size-full snap-x snap-mandatory overflow-x-hidden overscroll-x-contain pointer-coarse:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((slide, i) => (
          // Decorative copies of the card's link: the name is the one the keyboard and screen readers get.
          <Link key={i} href={href} tabIndex={-1} aria-hidden className="relative size-full shrink-0 snap-center snap-always">
            {slide}
          </Link>
        ))}
      </div>
      {children}
      {many ? (
        <>
          <Arrow side="left" hidden={index === 0} label={`Poza anterioară, ${label}`} onClick={(e) => go(e, -1)} />
          <Arrow side="right" hidden={index >= shown.length - 1} label={`Poza următoare, ${label}`} onClick={(e) => go(e, 1)} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {shown.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'size-1.5 rounded-full shadow-e1 transition-[opacity,transform] duration-(--duration-fast) ease-fast',
                  i === index ? 'scale-110 bg-photo-dot-active' : 'bg-photo-dot-active opacity-55'
                )}
              />
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}

function Arrow({ side, hidden, label, onClick }: { side: 'left' | 'right'; hidden: boolean; label: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void }) {
  if (hidden) return null;
  const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/90 text-ink shadow-e2',
        'opacity-0 transition-[opacity,transform] duration-(--duration-fast) ease-fast group-hover/photos:opacity-100 hover:scale-105 focus-visible:opacity-100',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        // Touch screens swipe: the arrows are for a mouse.
        'pointer-coarse:hidden',
        side === 'left' ? 'left-2.5' : 'right-2.5'
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
