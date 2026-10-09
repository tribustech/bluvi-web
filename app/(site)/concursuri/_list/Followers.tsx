'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { EyeIcon } from '@heroicons/react/20/solid';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { formatInt } from '@/components/cards/format';
import { FollowersList, followersSubtitle } from '@/components/cards/FollowersList';
import { cn } from '@/components/ui/cn';
import { competitionFollowersQuery, formatCount } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { anglerHref } from '@/lib/routes';

/*
 * fish components/FollowersPill.tsx + FollowersListSheet.tsx — how many follow a competition
 * (viewers), NOT a follow toggle; tapping it opens the list of followers. The surface is the
 * Fundații §07 rule for an angler list browsed while the page stays visible (intent «context»):
 * the bottom sheet on the phone, a dialog from 768, the docked side panel from 1280. The pill sits
 * above the card's stretched link (z-above), so it is its own control, never a click on the card.
 */

export function FollowersPill({
  viewers,
  competitionId,
  onPhoto = false,
  compact = false,
}: {
  viewers: number;
  competitionId: string;
  /**
   * Over the poster: the kit's on-photo count chip (Pill geometry — 24px, round, scrim; Fundații §07:
   * chips on a photo are round, as the LIVE pill beside it); on the card surface: the 22px ink pill.
   */
  onPhoto?: boolean;
  /**
   * Below 768: the eye and the number only; the name still says «N urmăritori». NOT fish `compact`
   * (FollowersPill.tsx: a smaller type that still prints the word) — the status lists keep the word.
   */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const count = Math.max(0, viewers);
  // formatCount's words after the number: «urmăritor», «urmăritori», «de urmăritori» from 20 (fish
  // FollowersPill prints the bare plural; the web takes the correct Romanian plural, owner rules).
  const words = formatCount(count, 'urmăritor', 'urmăritori').slice(String(count).length + 1);
  const close = () => {
    setOpen(false);
    // The docked panel is not modal (nothing restores focus for it): back to the pill.
    pill.current?.focus();
  };
  return (
    <>
      <button
        ref={pill}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          // A 44px hit area hangs outside the pill (the ::before), so it never makes its line taller.
          'relative z-above inline-flex shrink-0 cursor-pointer items-center gap-1 t-micro-strong whitespace-nowrap',
          "before:absolute before:-inset-x-1 before:content-['']",
          'transition-colors duration-(--duration-fast) ease-fast',
          onPhoto
            ? // TODO(kit): Pill tone="scrim" as a button (the kit's on-photo count chip). Its focus ring
              // is two-tone (a light outline over a dark ring) so it reads on any photo.
              'h-6 rounded-full px-2 before:-inset-y-2.5 bg-photo-scrim text-on-photo-scrim hover:bg-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-on-photo-scrim focus-visible:ring-4 focus-visible:ring-photo-scrim'
            : // 22px pill (fish compact) on the date line.
              'h-5.5 rounded-badge px-1.5 before:-inset-y-2.75 bg-ink-2 text-surface hover:bg-ink',
        )}
      >
        <EyeIcon aria-hidden className="size-3" />
        {formatInt(count)}
        <span className={cn(compact && 'max-md:sr-only')}> {words}</span>
      </button>
      {open ? <FollowersSurface onClose={close} competitionId={competitionId} /> : null}
    </>
  );
}

/** Mounted only while open (fish isSheetOpen): the read starts with the tap. */
function FollowersSurface({ onClose, competitionId }: { onClose: () => void; competitionId: string }) {
  const breakpoint = useBreakpoint();
  const t = useMemo(() => createBrowserTransport(), []);
  const { data: followers, isPending, isError, refetch, isFetching } = useQuery(competitionFollowersQuery(t, competitionId));

  const body = (
    <FollowersList
      followers={followers}
      pending={isPending}
      error={isError}
      retrying={isFetching}
      onRetry={() => void refetch()}
      hrefFor={anglerHref}
      onNavigate={onClose}
    />
  );

  const surface = (
    <ResponsiveSurface open intent="context" title="Urmăritori" subtitle={followersSubtitle(followers)} onClose={onClose} panelClassName="h-full">
      {body}
    </ResponsiveSurface>
  );
  if (pickSurface('context', breakpoint) !== 'panel') return surface;
  // ≥1280: the panel docks at the window's right edge under the top bar, over nothing it needs —
  // the list stays visible and usable beside it. Portalled out of the card (its clip and stacking).
  return createPortal(<DockedPanel>{surface}</DockedPanel>, document.body);
}

/** The side panel's dock: fixed under the top bar; focus moves into it (SidePanel closes on Escape). */
function DockedPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button[aria-label="Închide"]')?.focus();
  }, []);
  return (
    <div ref={ref} className="fixed top-16 right-0 bottom-0 z-overlay flex">
      {children}
    </div>
  );
}
