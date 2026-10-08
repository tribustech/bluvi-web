'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { formatCount } from '@/core/realtime/chat/format';
import { sectorFill } from '@/components/ranking/sector';
import { FlowSection } from '@/components/templates/T6';
import { TileChevron } from '@/components/templates/T6/TileChevron';
import { cn } from '@/components/ui/cn';
import { sectorAnchorId, type StandOccupant, type StandSectorGroup } from './occupant';
import { STAND_TILE_HEIGHT, STAND_TRACK } from './standGrid';
import { useNavigationGuard } from './useNavigationGuard';

/*
 * StandOccupantList — every stand of a competition, grouped by sector: the stand picker the scale
 * («Alege standul»), the penalties' «Alege standul» and the allocation screens share. Shared and
 * read-only for later batches (extend additively). Model: ./occupant.ts (standOccupantGroups,
 * filterStandGroups — build the groups there, filter there, pass them in).
 *
 *   <StandOccupantList
 *     groups={filterStandGroups(standOccupantGroups(competition, allocations), query)}
 *     hrefFor={(s) => routes.competitionScaleStand(id, s.standId)}   // a page per stand…
 *     onSelect={(s) => open(s)}                                     // …or an in-place choice
 *     disabledWhen={(s) => !s.allocated}                            // default
 *     emptyLabel="-" | "Nealocat"                                   // the unallocated stand's line
 *     showClub                                                      // national championship
 *     tone="accent" | "neutral"                                     // neutral: read-only target
 *     caption={(s) => …}                                            // a muted line under the occupant
 *   />
 *
 * - «Sector X» headings (h2) in the competition's order, the sector colour as the dot and each tile's
 *   leading edge (fish getColorsBySector → components/ranking/sector.ts tokens), «N standuri ·
 *   M nealocate» beside it.
 * - A tile: the stand label («Stand N», NC «Stand A1(10)»), the club (showClub), the occupant —
 *   «<echipă>:» bold on team competitions, then the participants or the guest.
 * - Disabled stands (default: unallocated) are drawn dashed and dimmed, are not focusable and do
 *   nothing (fish disabled + opacity .5; here the text keeps AA contrast).
 * - Phone: one tile per row (fish's list). From 768 a dense grid of tiles, more columns as the
 *   screen grows (rule 14: a wide screen gets its own layout, not the phone list stretched).
 * - A repeated activation within 800 ms is ignored (organizer.b.navigation-guard), and a tile that
 *   is navigating shows a spinner in place of its chevron (TileChevron).
 */

type Props = {
  groups: StandSectorGroup[];
  hrefFor?: (stand: StandOccupant) => string | null;
  onSelect?: (stand: StandOccupant) => void;
  disabledWhen?: (stand: StandOccupant) => boolean;
  emptyLabel: '-' | 'Nealocat';
  showClub?: boolean;
  tone?: 'accent' | 'neutral';
  /** A trailing slot per tile (a weighed total, a penalty count). */
  trailing?: (stand: StandOccupant) => ReactNode;
  /** A line under the occupant (why a stand is inert, e.g. «Înscriere indisponibilă»). */
  caption?: (stand: StandOccupant) => ReactNode;
  /** Prefix of the sector headings' ids (unique per page). */
  idPrefix?: string;
};


const notAllocated = (s: StandOccupant) => !s.allocated;

export function StandOccupantList({
  groups,
  hrefFor,
  onSelect,
  disabledWhen = notAllocated,
  emptyLabel,
  showClub = false,
  tone = 'accent',
  trailing,
  caption,
  idPrefix = 'sector',
}: Props) {
  const guard = useNavigationGuard();
  return (
    // From 768 the sectors share the tiles' column grid (same track, same gap): a sector of one or
    // two stands sits beside its neighbours instead of a full row each (a 24-sector field of single
    // stands is three screens of blank otherwise); a bigger sector spans the full width.
    <div data-testid="stand-groups" className={cn('flex flex-col gap-6 md:grid md:gap-x-3 xl:gap-y-8', STAND_TRACK)}>
      {groups.map((group) => {
        const fill = sectorFill(group.paletteLetter ?? '', group.color);
        const id = sectorAnchorId(idPrefix, group.name);
        return (
          <FlowSection
            key={group.sectorId}
            id={id}
            title={`Sector ${group.name}`}
            marker={<span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />}
            meta={[
              formatCount(group.stands.length, 'stand', 'standuri'),
              group.unallocated ? formatCount(group.unallocated, 'nealocat', 'nealocate') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            className={cn('scroll-mt-24', group.stands.length === 1 ? 'md:col-span-1' : group.stands.length === 2 ? 'md:col-span-2' : 'md:col-span-full')}
          >
            <ul
              aria-labelledby={id}
              data-testid={`stand-group-${group.name}`}
              className={cn(
                'grid grid-cols-1 gap-2',
                'md:gap-3',
                STAND_TRACK,
              )}
            >
              {group.stands.map((stand) => {
                const disabled = disabledWhen(stand);
                const href = !disabled && hrefFor ? hrefFor(stand) : null;
                return (
                  <li key={stand.standId} className="flex">
                    <StandTile
                      stand={stand}
                      fill={fill}
                      disabled={disabled}
                      href={href}
                      onSelect={!disabled && !href && onSelect ? () => guard() && onSelect(stand) : undefined}
                      onLinkClick={(e) => guard(e)}
                      emptyLabel={emptyLabel}
                      showClub={showClub}
                      tone={tone}
                      trailing={trailing?.(stand)}
                      caption={caption?.(stand)}
                    />
                  </li>
                );
              })}
            </ul>
          </FlowSection>
        );
      })}
    </div>
  );
}

const SHAPE = cn(
  'relative flex w-full items-start gap-3 overflow-hidden rounded-card py-3 pr-3 pl-4 text-left xl:py-2.5',
  STAND_TILE_HEIGHT,
);
const INTERACTIVE =
  'transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const TONE = {
  accent: 'bg-accent-tint hover:bg-accent-tint-2',
  // The neutral target sits in the task card: the kit's in-card resting fill, one step darker on hover.
  neutral: 'bg-soft-fill hover:bg-shimmer',
};

function StandTile({
  stand,
  fill,
  disabled,
  href,
  onSelect,
  onLinkClick,
  emptyLabel,
  showClub,
  tone,
  trailing,
  caption,
}: {
  stand: StandOccupant;
  fill: { className: string; style?: { background: string } };
  disabled: boolean;
  href: string | null;
  onSelect?: () => void;
  onLinkClick: (e: { preventDefault: () => void }) => void;
  emptyLabel: '-' | 'Nealocat';
  showClub: boolean;
  tone: 'accent' | 'neutral';
  trailing?: ReactNode;
  caption?: ReactNode;
}) {
  const body = (
    <>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', disabled ? 'opacity-40' : '', fill.className)} style={fill.style} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('t-body-strong', disabled ? 'text-ink-2' : 'text-ink')}>{stand.label}</span>
        {showClub && stand.club ? <span className="t-label truncate text-accent-ink">{stand.club}</span> : null}
        <span className={cn('t-caption line-clamp-2', disabled ? 'text-muted' : 'text-ink-2')}>
          {stand.allocated ? <Occupant stand={stand} /> : emptyLabel === '-' ? <><span aria-hidden>-</span><span className="sr-only">nealocat</span></> : emptyLabel}
        </span>
        {caption ? <span className="t-caption text-muted">{caption}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">{trailing}</span> : null}
    </>
  );
  if (disabled) {
    return (
      <div
        aria-disabled
        data-testid={`stand-${stand.standId}`}
        data-allocated={stand.allocated}
        // An outline, not a border: the dashed edge must not shift the content by a pixel.
        className={cn(SHAPE, 'bg-transparent outline-1 -outline-offset-1 outline-faint outline-dashed')}
      >
        {body}
      </div>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        onClick={onLinkClick}
        data-testid={`stand-${stand.standId}`}
        data-allocated={stand.allocated}
        className={cn(SHAPE, INTERACTIVE, TONE[tone])}
      >
        {body}
        <TileChevron />
      </Link>
    );
  }
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        data-testid={`stand-${stand.standId}`}
        data-allocated={stand.allocated}
        className={cn(SHAPE, INTERACTIVE, 'cursor-pointer', TONE[tone])}
      >
        {body}
        <ChevronRightIcon aria-hidden className="size-6 shrink-0 self-center text-ink-2" />
      </button>
    );
  }
  return (
    <div data-testid={`stand-${stand.standId}`} data-allocated={stand.allocated} className={cn(SHAPE, tone === 'accent' ? 'bg-accent-tint' : 'bg-soft-fill')}>
      {body}
    </div>
  );
}

/** fish: «<echipă>: » bold on team competitions, then the participants or the guest. */
function Occupant({ stand }: { stand: StandOccupant }) {
  if (stand.team) {
    return (
      <>
        <span className="font-bold">{stand.people ? `${stand.team}: ` : stand.team}</span>
        {stand.people}
      </>
    );
  }
  return <>{stand.people ?? '-'}</>;
}
