import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The map's markers, ported from fish (ROADMAP §4b.25) at every width: the Bluvi map pin
 * (assets/logo/bluvi_map_pin.png — the white teardrop round the fish badge, 36×46, tip on the
 * coordinate) and fish's counted cluster bubbles with two halo rings (LakesResultsWithMap
 * ClusterBubble: blue, red from 11). Each is a real <button> (Tab reaches it, Enter selects it) with
 * at least a 44px hit area.
 */

/** fish bluvi_map_pin.png at 2× / 3× (public/images), drawn at its 1× size. */
const PIN_SRC = '/images/map-pin@2x.png';
const PIN_SRCSET = '/images/map-pin@2x.png 2x, /images/map-pin@3x.png 3x';

/**
 * fish's pin: the white teardrop with the fish badge, its tip on the coordinate (anchor «bottom»).
 * Visual only (the button names it).
 */
export function T2PinGlyph({ className }: { className?: string }) {
  return (
    // A static brand asset at its own size: next/image would add a wrapper and a loader for 8 KB.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PIN_SRC}
      srcSet={PIN_SRCSET}
      alt=""
      aria-hidden
      width={36}
      height={46}
      draggable={false}
      className={cn('block h-11.5 w-9 drop-shadow-[0_2px_3px_var(--color-scrim)] select-none', className)}
    />
  );
}

/**
 * A place: fish's teardrop pin. fish draws every lake the same and opens the pin card for the
 * tapped one; the web lifts the selected pin (larger) so the card and its pin read as one, and
 * raises the pin whose list row is hovered or focused (owner rule 7, card ↔ marker, from 768).
 * With a `badge` (a price, a rating — owner rule 7, imobiliare.ro) the pin is that pill from 768;
 * the phone keeps fish's pin (§4b.25).
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
   * From 768 the pin as a price / rating pill instead of fish's pin (owner rule 7 — imobiliare.ro's
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
        // 44×46 target, content at its bottom: the tip stays on the coordinate (anchor «bottom»).
        'group flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-end outline-none',
        'origin-bottom transition-transform duration-(--duration-fast) ease-select',
        selected ? 'scale-125' : highlighted ? 'scale-115' : 'hover:scale-110',
      )}
    >
      <span
        className={cn(
          'rounded-t-full rounded-b-card group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
          badge != null && 'md:hidden',
        )}
      >
        <T2PinGlyph />
      </span>
      {badge != null ? (
        <span aria-hidden className="hidden flex-col items-center md:flex">
          <span
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
            className={cn(
              '-mt-1.5 size-2.5 rotate-45 rounded-badge transition-colors duration-(--duration-fast) ease-fast',
              selected || highlighted ? 'bg-accent-ink' : 'bg-surface group-hover:bg-accent-tint',
            )}
          />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Bubble sizes (CSS px): the outer halo of a cluster. T2Map spaces clusters by the largest one
 * (CLUSTER_RADIUS), so bubbles never overlap.
 */
export const CLUSTER_SIZE_PX = { small: 56, large: 56 } as const;

/**
 * A counted cluster — fish LakesResultsWithMap ClusterBubble: a 56px ring (15%), a 48px ring
 * (30%), a 40px core (wider for long counts) with the white 14/800 count; blue up to 10 places,
 * red from 11 (`large`). `tone="water"` is fish's public-waters CountBadge: the indigo core in a
 * 2px white ring on one 20% indigo halo. Highlighted (the list card of a place inside it is
 * hovered — owner rule 7): ringed in accent ink, raised.
 */
export function T2MapCluster({
  label,
  count,
  large,
  tone = 'lakes',
  highlighted = false,
  onClick,
}: {
  label: string;
  count: number;
  large: boolean;
  tone?: 'lakes' | 'water';
  /** It holds the place hovered in the list (owner rule 7, card ↔ marker): ringed, its count kept. */
  highlighted?: boolean;
  onClick?: () => void;
}) {
  const water = tone === 'water';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-highlighted={highlighted || undefined}
      data-cluster-tone={water ? 'water' : large ? 'large' : 'small'}
      className={cn(
        'group flex cursor-pointer items-center justify-center rounded-full outline-none',
        'transition-transform duration-(--duration-fast) ease-select hover:scale-105',
        highlighted && 'scale-125 ring-4 ring-accent-ink ring-offset-2 ring-offset-surface',
        water ? 'min-h-11 min-w-11 bg-map-water-cluster-halo p-1' : cn('size-14', large ? 'bg-map-cluster-hot-halo' : 'bg-map-cluster-halo'),
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full',
          water ? 'contents' : cn('size-12', large ? 'bg-map-cluster-hot-halo-2' : 'bg-map-cluster-halo-2'),
        )}
      >
        <span
          style={water ? { height: waterCore(count), minWidth: waterCore(count) } : undefined}
          className={cn(
            'flex items-center justify-center rounded-full t-num-14 text-on-map-cluster',
            'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
            water
              ? 'border-2 border-on-map-cluster bg-map-water-cluster px-1.5'
              : cn('h-10 min-w-10 px-2.5', large ? 'bg-map-cluster-hot' : 'bg-map-cluster'),
          )}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

/** fish PublicWaterClusters coreSize: the core grows with the count (log), 26 → 42px. */
function waterCore(count: number): number {
  return Math.round(Math.min(Math.max(20 + Math.log10(Math.max(count, 1)) * 9, 26), 42));
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
