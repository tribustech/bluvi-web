'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import type { CommunityMemberDTO } from '@/core/partide';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';

/*
 * The small pieces every Partide community card shares (fish features/partide/components/card/* and
 * community/AnglerAvatars): the photo with its fallback, the corner ribbon, the venue meta line,
 * the avatars of a partidă's members, the footer. Kit pieces underneath (Avatar, FaceStack); the
 * fish palette is mapped onto the tokens (rose → live, indigo → accent, gray → muted / hairline).
 */

export const PLACEHOLDER_LAKE = '/images/placeholder-lake.jpg';

/** The keyboard ring of a stretched or inline link inside a card (kit CardTitle's). */
export const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * A remote catch / venue photo. A missing or failed one shows fish's lake placeholder (the rail
 * and the records never show a grey hole or the broken-image glyph); an error that fired before
 * hydration is caught by the ref.
 */
export function Photo({ src, className, eager = false }: { src: string | null | undefined; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const check = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && src && img.complete && img.naturalWidth === 0) setFailed(src);
    },
    [src],
  );
  const url = src && failed !== src ? src : PLACEHOLDER_LAKE;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- CMS rendition (grid / thumb), already sized.
    <img
      ref={url === src ? check : undefined}
      src={url}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => src && setFailed(src)}
      className={cn('size-full object-cover', className)}
    />
  );
}

export type RibbonVariant = 'live' | 'duel' | 'finished';

/**
 * fish PartidaCard ribbon — the card's state in its top-right corner: «LIVE» / «DUEL LIVE» on the
 * live pair (pulsing dot), «ÎNCHEIATĂ» on the neutral pair. Says the state once for screen readers.
 */
export function Ribbon({ variant, label }: { variant: RibbonVariant; label: string }) {
  const live = variant !== 'finished';
  return (
    <span
      className={cn(
        'absolute top-0 right-0 z-above flex items-center gap-1.25 rounded-bl-control px-3 py-2 t-micro-strong tracking-[0.6px] uppercase',
        live ? 'bg-status-live-bg text-status-live-fg' : 'bg-status-neutral-bg text-status-neutral-fg',
      )}
      data-testid="card-ribbon"
    >
      {live ? <span aria-hidden className="size-1.25 rounded-full bg-current animate-live" /> : null}
      {label}
    </span>
  );
}

/**
 * fish CardHeader meta — the venue pin (red at full strength: a locator, not decoration), the venue
 * as `strong` (an angler-titled card) and/or a muted `text`.
 */
export function MetaLine({ strong, text }: { strong?: string | null; text?: string | null }) {
  if (!strong && !text) return null;
  return (
    <p className="flex min-w-0 items-center gap-1.25">
      <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-live" />
      {strong ? <span className="min-w-0 truncate t-label text-ink">{strong}</span> : null}
      {text ? <span className={cn('t-caption text-muted', strong ? 'shrink-0' : 'min-w-0 truncate')}>{text}</span> : null}
    </p>
  );
}

const nameOf = (m: CommunityMemberDTO) => m.name?.trim() || 'Pescar';

/**
 * fish MemberAvatars (max 3, white ring): one member → a single face, a team → the kit FaceStack.
 * Decorative: the names are printed beside it.
 */
export function MemberFaces({ members, size = 40 }: { members: CommunityMemberDTO[]; size?: 32 | 40 | 44 | 48 }) {
  if (members.length <= 1) {
    const m = members[0];
    return m ? <Avatar name={nameOf(m)} src={m.avatarUrl} size={size} /> : null;
  }
  const stack = size >= 40 ? 40 : 32;
  return (
    <FaceStack
      people={members.slice(0, 3).map(m => ({ name: nameOf(m), src: m.avatarUrl }))}
      overflow={Math.max(0, members.length - 3)}
      size={stack}
    />
  );
}

/**
 * fish AnglerAvatars — the host's face plus a «+N» disc for a team catch / record, on a photo
 * (white ring). Nothing when the record has no attributed angler.
 */
export function AnglerAvatars({ angler, extraMembers }: { angler: CommunityMemberDTO | null; extraMembers: number }) {
  if (!angler) return null;
  return (
    <FaceStack people={[{ name: nameOf(angler), src: angler.avatarUrl }]} overflow={extraMembers > 0 ? extraMembers : 0} size={24} className="shrink-0" />
  );
}

/**
 * fish CardFooter — a hairline, the muted caption on the left and the action on the right. The
 * action is the look of a link only (aria-hidden): the card's title is its one link (kit CardTitle,
 * stretched), so a press anywhere on the card goes where the action says.
 */
export function CardFooter({ left, action }: { left?: ReactNode; action?: string | null }) {
  return (
    <footer className="flex min-h-6 items-center justify-between gap-3 border-t border-hairline pt-3">
      <span className="min-w-0 flex-1 truncate t-caption text-muted">{left}</span>
      {action ? (
        <span aria-hidden className="inline-flex shrink-0 items-center gap-0.5 t-label text-accent-ink">
          {action}
          <ChevronRightIcon className="size-4" />
        </span>
      ) : null}
    </footer>
  );
}

/** A weight with its unit as its own, smaller element (owner rule 10): «6,4» + «kg». */
export function Kg({
  value,
  className,
  unitClassName,
  'data-testid': testId,
}: {
  value: string;
  className?: string;
  unitClassName?: string;
  'data-testid'?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 whitespace-nowrap', className)} data-testid={testId}>
      <span>{value}</span>
      <span className={cn('t-micro-strong', unitClassName)}>kg</span>
    </span>
  );
}
