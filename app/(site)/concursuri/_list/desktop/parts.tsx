import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { CompetitionCard } from '@/core/competitions';
import { dayParts } from './dates';

/*
 * What the desktop tab views share: dates in Bucharest, the calendar leaf, the photo, the lake line,
 * the CTA and the row list. Composition only — every visual is a kit component
 * or a token utility.
 */

/* ---------------------------------------------------------------- dates (Bucharest) */

const DAYS = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'] as const;
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;

/** The calendar leaf: weekday, day, month (start day; a range adds «+N» days). */
export function DateBlock({ card, size = 'md' }: { card: CompetitionCard; size?: 'md' | 'sm' }) {
  if (!card.startDate) return <div className="t-caption text-muted">—</div>;
  const s = dayParts(card.startDate);
  const e = card.endDate ? dayParts(card.endDate) : s;
  const days = e.index - s.index;
  return (
    <div
      className={cn('flex shrink-0 flex-col items-center justify-center rounded-control bg-accent-tint text-accent-ink', size === 'md' ? 'size-16' : 'size-12')}
      aria-hidden
    >
      <span className="t-eyebrow uppercase">{DAYS[s.weekday]}</span>
      <span className={size === 'md' ? 't-num-26' : 't-num-18'}>{s.day}</span>
      <span className="t-eyebrow uppercase">
        {MONTHS[s.month]}
        {days > 0 ? ` +${days}` : ''}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- media */

/** fish's poster order: banner, else the lake's photo. */
export function photoOf(c: CompetitionCard, big = false): string | null {
  const m = c.banner ?? c.lake?.image ?? null;
  if (!m) return null;
  return big ? (m.mediumUrl ?? m.url) : (m.smallUrl ?? m.url);
}

/** A fixed-size photo; a card without one keeps the slot (soft-fill), so rows never shift. */
export function Thumb({ card, className, big = false, sizes = '120px', children }: { card: CompetitionCard; className?: string; big?: boolean; sizes?: string; children?: ReactNode }) {
  const src = photoOf(card, big);
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', className)}>
      {src ? <Image src={src} alt="" fill sizes={sizes} className="object-cover" /> : null}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- copy */

export function lakeLine(c: CompetitionCard): string {
  if (!c.lake) return 'Baltă nespecificată';
  return c.lake.county ? `${c.lake.name} · ${c.lake.county.name}` : c.lake.name;
}

export function LakeLine({ card, className }: { card: CompetitionCard; className?: string }) {
  return (
    <p className={cn('flex min-w-0 items-center gap-1 t-label text-accent-ink', className)}>
      <MapPinIcon aria-hidden className="size-3 shrink-0 text-accent" />
      <span className="truncate">{lakeLine(card)}</span>
    </p>
  );
}

/**
 * The row's CTA. A row is ONE link (cards.c1): when the CTA would open the same page as the row's
 * stretched link (`rowHref`), it is drawn but not a second link — no second tab stop, no second
 * announcement; a click falls through to the row. Only a distinct target (the ranking) is a link.
 */
export function Cta({
  href,
  rowHref,
  label,
  variant,
  full = false,
  className,
}: {
  href: string;
  rowHref?: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'outline';
  full?: boolean;
  className?: string;
}) {
  if (href === rowHref) {
    return (
      <span aria-hidden className={full ? cn('inline-flex h-9 items-center justify-center rounded-control bg-soft-fill px-3 t-button-compact text-muted', className) : buttonClass({ variant, size: 'compact', className })}>
        {label}
      </span>
    );
  }
  if (full) {
    return (
      <span className={cn('relative z-above inline-flex h-9 items-center justify-center rounded-control bg-soft-fill px-3 t-button-compact text-muted', className)}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClass({ variant, size: 'compact', className: cn('relative z-above', className) })}>
      {label}
    </Link>
  );
}

/* ---------------------------------------------------------------- rows */

/** The row list's surface: one card, hairlines between rows. */
export const ROW_LIST = 'flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0';

/** The stretched link of a row: the competition's name; the whole row opens it (cards.c1). */
export const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent";

/** A grey bar where a value is still being read (rule 4: never a guess). */
export function ValueBone({ className, onNavy = false }: { className?: string; onNavy?: boolean }) {
  return <span aria-hidden className={cn('block h-3 animate-pulse rounded-full', onNavy ? 'bg-lavender/15' : 'bg-soft-fill', className)} />;
}
