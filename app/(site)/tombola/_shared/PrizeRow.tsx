'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { ChevronDownIcon, GiftIcon } from '@heroicons/react/24/outline';
import type { RafflePrizeDto } from '@/core/organizer';
import { cn } from '@/components/ui/cn';
import { badgeTextOn, parseCssColor, resolveCssColor } from './badge';
import { prizeSubtitle, raffleCopy, registrationsLabel } from './copy';

export type PrizeRowVariant = 'intro' | 'status';

type Props = {
  prize: RafflePrizeDto;
  /** The type's label («Crap»), or its key when the session has no such type; '' = no badge. */
  typeLabel: string;
  /** The CMS `badgeColor` (any CSS colour). Without one (or invalid) the badge is the accent. */
  typeBadgeColor?: string | null;
  /** «{n} înscriși» for the prize's type (intro); omitted on the status page, as fish. */
  registrations?: number;
  /** Controlled: the items list is open. Leave undefined for an uncontrolled row. */
  expanded?: boolean;
  /** Uncontrolled start state (fish intro opens every prize on mount). */
  defaultExpanded?: boolean;
  onToggle?: (next: boolean) => void;
  variant?: PrizeRowVariant;
};

const noopSubscribe = () => () => {};

/**
 * fish components/raffle/ExpandablePrizeRow.tsx (variants intro / status) for every raffle page.
 * Image (44 / 56) or a tinted gift placeholder, the title («{count} ×» before it when there is no
 * price), the subtitle («{description} · {price} LEI × {count}»), «{n} înscriși» and the type badge
 * in the CMS colour on the right. A prize with items gets the «1 produs / {n} produse» toggle (a real
 * button with aria-expanded) listing each item's image, label and description.
 * participant.raffle-intro.c6.
 */
export function PrizeRow({
  prize,
  typeLabel,
  typeBadgeColor,
  registrations,
  expanded,
  defaultExpanded = true,
  onToggle,
  variant = 'intro',
}: Props) {
  const [ownOpen, setOwnOpen] = useState(defaultExpanded);
  const open = expanded ?? ownOpen;
  const itemsId = useId();
  const items = prize.items ?? [];
  const hasPrice = prize.priceLei != null;
  const subtitle = prizeSubtitle(prize);
  const size = variant === 'status' ? 'size-14' : 'size-11';

  const toggle = () => {
    const next = !open;
    if (expanded === undefined) setOwnOpen(next);
    onToggle?.(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn('flex items-center gap-3', variant === 'intro' && 'rounded-control bg-accent-tint px-2.5 py-2')}>
        <span className={cn('relative shrink-0 overflow-hidden', size, variant === 'status' ? 'rounded-avatar' : 'rounded-control', 'bg-accent-tint-2')}>
          {prize.image?.url ? (
            <Image src={prize.image.url} alt="" fill sizes={variant === 'status' ? '56px' : '44px'} className="object-cover" />
          ) : (
            <GiftIcon aria-hidden className="absolute inset-0 m-auto size-6 text-accent-ink" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-body-strong line-clamp-2 min-w-0 text-ink">
            {!hasPrice ? <span className="text-ink-2">{prize.count} × </span> : null}
            {prize.title}
          </span>
          {subtitle ? <span className="t-caption text-ink-2">{subtitle}</span> : null}
          {items.length > 0 ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={itemsId}
              className="t-caption -ml-1 flex min-h-8 items-center gap-1 self-start rounded-control px-1 font-semibold text-ink-2 hover:bg-accent-tint-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {raffleCopy.prizeItems.countLabel(items.length)}
              <ChevronDownIcon aria-hidden className={cn('size-4 transition-transform duration-(--duration-fast)', open && 'rotate-180')} />
            </button>
          ) : null}
        </span>
        {registrations != null || typeLabel ? (
          <span className="flex shrink-0 flex-col items-end gap-1">
            {registrations != null && variant !== 'status' ? <span className="t-caption text-ink-2">{registrationsLabel(registrations)}</span> : null}
            {typeLabel ? <TypeBadge label={typeLabel} color={typeBadgeColor ?? null} /> : null}
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul id={itemsId} hidden={!open} className={cn('flex flex-col gap-2 rounded-control bg-accent-tint/60 py-2 pr-2', variant === 'status' ? 'pl-17' : 'pl-15')}>
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-control bg-accent-tint-2">
                {item.image?.url ? <Image src={item.image.url} alt="" fill sizes="40px" className="object-cover" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-body-strong line-clamp-2 text-ink">{item.label}</span>
                {item.description ? <span className="t-caption line-clamp-2 text-ink-2">{item.description}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The type badge: a pill in the CMS's colour (fish), its label in white or ink, whichever reads
 * better (./badge.ts). Named colours resolve in the browser only, so the server snapshot uses what
 * it can parse and the client corrects it after hydration.
 */
export function TypeBadge({ label, color }: { label: string; color: string | null }) {
  const fg = useSyncExternalStore(
    noopSubscribe,
    () => {
      const rgb = resolveCssColor(color);
      return rgb ? badgeTextOn(rgb) : '';
    },
    () => {
      const rgb = color ? parseCssColor(color) : null;
      return rgb ? badgeTextOn(rgb) : '';
    },
  );
  if (!fg) {
    return <span className="t-caption inline-flex rounded-full bg-accent px-2.5 py-1 font-semibold text-on-accent">{label}</span>;
  }
  return (
    <span className="t-caption inline-flex rounded-full px-2.5 py-1 font-semibold" style={{ backgroundColor: color ?? undefined, color: fg }}>
      {label}
    </span>
  );
}
