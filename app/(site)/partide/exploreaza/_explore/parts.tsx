'use client';

import type { ReactNode } from 'react';
import { ChevronDownIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { PartidaCardSkeleton } from '@/components/partide/community/AcasaSceneSkeleton';
import { LiveDot } from '@/components/templates/LiveDot';
import { filterChipClass, PILL_H, FOCUS_RING } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';

/*
 * The small pieces of Partide · Explorează (partide.exploreaza): the LIVE chip, the venue chip, the
 * section heading, the dense card grid and the skeletons.
 */

/**
 * fish LiveChip (c1): visually apart from the other chips — the rose «live» fill with a pulsing white
 * dot when on (live-only mode), a static rose dot on the plain chip when off.
 */
export function LiveChip({ pressed, onChange }: { pressed: boolean; onChange: (pressed: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      data-testid="chip-live"
      className={cn(
        pressed
          ? cn(
              PILL_H,
              'inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-3.5 t-label whitespace-nowrap',
              'bg-status-live-bg text-status-live-fg transition-opacity duration-(--duration-fast) ease-fast hover:opacity-90 active:opacity-80',
              FOCUS_RING,
            )
          : filterChipClass(),
      )}
    >
      {pressed ? <LiveDot tone="inverse" size="md" /> : <span aria-hidden className="size-2 shrink-0 rounded-full bg-live" />}
      LIVE
    </button>
  );
}

/**
 * fish's venue chip (c1): pin + «Toate bălțile» or the picked venue + chevron, opening the picker.
 * `name` undefined: a venue from the URL whose name is still being read — a bone, never a guess.
 */
export function VenueChip({
  venueKey,
  name,
  expanded,
  onClick,
}: {
  venueKey: string | null;
  name: string | null | undefined;
  expanded: boolean;
  onClick: () => void;
}) {
  const active = venueKey !== null;
  const label = active ? name : 'Toate bălțile';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={active ? `Baltă: ${name ?? 'se încarcă'}. Schimbă` : 'Filtrează după baltă: Toate bălțile'}
      className={filterChipClass({ active })}
      data-testid="chip-venue"
    >
      <MapPinIcon aria-hidden className="size-4 shrink-0" />
      {label ? <span className="max-w-48 truncate">{label}</span> : <span aria-hidden className="h-3 w-24 animate-shimmer rounded-full" />}
      <ChevronDownIcon aria-hidden className="size-4 shrink-0" />
    </button>
  );
}

/**
 * A section of the list (fish's «ÎN DIRECT» / «ÎNCHEIATE» rows): a small caps heading — part of the
 * page, never sticky (owner rule 3) — an optional action at the end of the same row, then the body.
 */
export function ExploreSection({
  id,
  title,
  live = false,
  action,
  children,
  testId,
}: {
  id: string;
  title: string;
  live?: boolean;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 px-1 t-eyebrow tracking-[0.7px] text-muted uppercase">
          {live ? <LiveDot size="md" /> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The cards of a section: one column on a phone, then as many ≥340px columns as fit (owner rule 5:
 * dense, auto-fill — more columns on a wider screen, never wider cards). Cards keep their own height.
 */
export const EXPLORE_GRID = 'grid grid-cols-1 items-start gap-4 md:grid-cols-[repeat(auto-fill,minmax(--spacing(85),1fr))]';

export function ExploreGrid({ children, label, testId }: { children: ReactNode; label: string; testId?: string }) {
  return (
    <ul aria-label={label} className={EXPLORE_GRID} data-testid={testId}>
      {children}
    </ul>
  );
}

const BONE = 'block animate-shimmer rounded-full';

/**
 * fish CommunitySceneSkeleton's list part: a section label and cards in the grid's shape. The whole
 * list's (explore-skeleton) only on the first load (c16); a section's own pending state otherwise.
 */
export function ExploreListSkeleton({ label = 'Se încarcă partidele…', testId = 'explore-skeleton' }: { label?: string; testId?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3" data-testid={testId}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex min-h-8 items-center px-1">
        <span className={cn(BONE, 'h-3 w-20')} />
      </span>
      <div aria-hidden className={EXPLORE_GRID}>
        <PartidaCardSkeleton />
        <PartidaCardSkeleton photos={false} />
        <span className="max-md:hidden">
          <PartidaCardSkeleton />
        </span>
        <span className="max-xl:hidden">
          <PartidaCardSkeleton photos={false} />
        </span>
      </div>
    </div>
  );
}

/** The filter row while the page loads (loading.tsx): the four chips, inert. */
export function ExploreChipsSkeleton() {
  return (
    <div aria-hidden className="flex min-w-0 items-center gap-2 overflow-hidden">
      {['LIVE', 'Cu notificări', 'Prieteni', 'Toate bălțile'].map(label => (
        <span key={label} className={cn(filterChipClass(), 'pointer-events-none')}>
          {label}
        </span>
      ))}
    </div>
  );
}
