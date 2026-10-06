import type { ReactNode } from 'react';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';

/*
 * The map's markers. fish draws a round fish badge (assets/logo/bluvi_map_pin.png) and counted
 * cluster bubbles with two halo rings; the web keeps both shapes in the token colours. Each is a
 * real <button> (Tab reaches it, Enter selects it) with at least a 44px hit area (pins: a 44px
 * box around the 32px badge; clusters: 56 / 64).
 */

/**
 * A place: the fish badge with a tip that sits on the coordinate (anchor «bottom»).
 * Selected = larger with an accent halo (fish: the pin card is open for it) — the same accent as
 * the selected list item's outline (T2ListItem), so the two halves of one selection match;
 * highlighted = its list row is hovered or focused.
 */
export function T2MapPin({
  id,
  label,
  selected = false,
  highlighted = false,
  onClick,
  onHover,
  badge = null,
}: {
  /** The point id (`data-t2-pin`): focus returns here when the pin card closes. */
  id?: string;
  label: string;
  /**
   * The pin as a price / rating pill instead of the fish badge (owner rule 7 — imobiliare.ro's
   * «€ 94K» pins): «45 lei», «★ 4,8». Visual only: the accessible name stays `label`.
   */
  badge?: ReactNode;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  /** Pointer / focus on (true) and off (false): the page highlights the list card. */
  onHover?: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-t2-pin={id}
      data-highlighted={highlighted || undefined}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
      className={cn(
        // 44×44 target, content at its bottom: the tip stays on the coordinate (anchor «bottom»).
        'group flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-end outline-none',
        'origin-bottom transition-transform duration-(--duration-fast) ease-select',
        selected ? 'scale-125' : highlighted ? 'scale-115' : 'hover:scale-110',
      )}
    >
      {badge != null ? (
        <>
          <span
            aria-hidden
            data-t2-pin-badge=""
            className={cn(
              'flex h-7 items-center gap-0.5 rounded-full border-2 px-2 t-label whitespace-nowrap tabular-nums shadow-e2',
              'transition-colors duration-(--duration-fast) ease-fast',
              'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
              selected || highlighted
                ? 'border-on-accent bg-accent-ink text-on-accent'
                : 'border-surface bg-surface text-ink group-hover:bg-accent-tint group-hover:text-accent-ink',
              selected && 'ring-4 ring-accent-tint-2',
            )}
          >
            {badge}
          </span>
          <span
            aria-hidden
            className={cn(
              '-mt-1.5 size-2.5 rotate-45 rounded-badge transition-colors duration-(--duration-fast) ease-fast',
              selected || highlighted ? 'bg-accent-ink' : 'bg-surface group-hover:bg-accent-tint',
            )}
          />
        </>
      ) : (
        <>
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full border-2 border-on-accent bg-accent text-on-accent shadow-e2',
              'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
              // The halo in a colour token (accent-tint-2 is tuned for dark), not an opacity of accent.
              selected && 'ring-4 ring-accent-tint-2',
            )}
          >
            <FishIcon size={18} />
          </span>
          {/* The tip: a 6px rotated square under the badge. */}
          <span
            aria-hidden
            className="-mt-1.5 size-2.5 rotate-45 rounded-badge bg-accent"
          />
        </>
      )}
    </button>
  );
}

/**
 * Bubble sizes (CSS px): the outer halo of a small and of a large cluster. T2Map spaces clusters by
 * the largest one (CLUSTER_RADIUS), so bubbles never overlap.
 */
export const CLUSTER_SIZE_PX = { small: 56, large: 64 } as const;

/**
 * A counted cluster. fish: 56px halo, 48px ring, 40px core; > 10 places use the «large» style.
 * fish's red/blue are not in Fundații (rose is reserved for live competitions, lavender-on-navy for
 * the signature number), so both sizes are one colour family — accent-tint halos round an
 * accent-ink core — and large differs by size only (64 / 56 / 48). The count is a numeral: 800,
 * tabular (t-num-16, the ranking-pill number step), white on accent-ink (7.9:1).
 */
export function T2MapCluster({
  label,
  count,
  large,
  highlighted = false,
  onClick,
}: {
  label: string;
  count: number;
  large: boolean;
  /** It holds the lake hovered in the list (owner rule 7, card ↔ marker): ringed, its count kept. */
  highlighted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-highlighted={highlighted || undefined}
      className={cn(
        'group flex cursor-pointer items-center justify-center rounded-full bg-accent-tint outline-none',
        'transition-transform duration-(--duration-fast) ease-select hover:scale-105',
        highlighted && 'scale-125 ring-4 ring-accent-ink ring-offset-2 ring-offset-surface shadow-e2',
        large ? 'size-16' : 'size-14',
      )}
    >
      <span className={cn('flex items-center justify-center rounded-full bg-accent-tint-2', large ? 'size-14' : 'size-12')}>
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-accent-ink t-num-16 text-on-accent',
            'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
            large ? 'h-12 min-w-12 px-3' : 'h-10 min-w-10 px-2.5',
          )}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

/**
 * The user's position (fish showsUserLocation), in two layers so a cluster's count under it stays
 * legible: T2Map draws the wide pale halo (T2UserHalo) UNDER the bubbles and pins, and only the dot
 * (T2UserDot) above them. Told apart from the lakes by shape, not only colour: no count, a small
 * solid dot in a thick 3px surface ring with a lifted shadow (e2). Still (Fundații §06: only LIVE
 * pulses). Neither takes pointer events, so they never block a pin.
 */
export function T2UserHalo() {
  return <span aria-hidden className="block size-10 rounded-full bg-status-info-bg" />;
}

export function T2UserDot() {
  return <span aria-hidden className="block size-4.5 rounded-full border-3 border-surface bg-status-info-fg shadow-e2" />;
}
