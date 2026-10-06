'use client';

import { ArrowRightIcon, MapPinIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { T2Spinner } from '@/components/templates/T2';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { PUBLIC_WATER_TYPE_LABEL, publicWaterLocationLabel, publicWaterName, type PublicWaterType } from '@/core/lakes';
import { LakeIcon, RiverIcon } from '../icons';
import type { WaterOutline } from './outline';

/*
 * The public-waters map view's list card (owner rule 7, ROADMAP §4b — imobiliare.ro's horizontal
 * card, in the shape /balti/harta's LakeRowCard has): one card per row,
 * - a title row across the top (the name);
 * - left, the media: the water itself, its outline drawn from its geometry (each water its own
 *   shape; the type glyph only until the outline is read), 4:3, ~38% of a wide card;
 * - right, the signature number (the surface, «39.266 ha» — a river has none, rule 4), where
 *   (county / «N județe») and the key-fact chips (Lac natural / Râu…, «Baltă pe Bluvi»);
 * - the actions as their own row: «Direcții» (the navigation apps) and «Vezi apa» (its page — the
 *   lake's page when a Bluvi lake claims it).
 * No activity line (partide active, catches): the list reads only the bundled dataset, and a
 * per-row request for 150 waters is not something the map view may fire (c3) — rule 4: what we do
 * not know, we do not show.
 *
 * The whole card selects the water on the map (its name is the stretched button — the first
 * button of the row, as before); the actions sit above it. Hover / focus is the map link: the
 * card's pin takes T2's halo (T2ListItem `onHighlight`).
 */

export type WaterRowCardProps = {
  id: number;
  name: string | null;
  type: PublicWaterType;
  county: string | null;
  countyIds: number[];
  areaKm2: number | null;
  /** The water's outline (outline.ts, read for the listed waters), else the type glyph. */
  outline?: WaterOutline | null;
  /** Its record is loading after a tap. */
  busy?: boolean;
  /** «Vezi apa»: the water's page, or the lake that claims it. */
  href: string;
  /** A Bluvi lake claims it («Vezi apa» opens the lake): a tag says so. */
  claimed?: boolean;
  onSelect: () => void;
  onDirections: () => void;
};

export function WaterRowCard({ name, type, county, countyIds, areaKm2, outline, busy = false, href, claimed = false, onSelect, onDirections }: WaterRowCardProps) {
  const title = publicWaterName({ name });
  const ha = areaKm2 != null && areaKm2 > 0 ? Math.round(areaKm2 * 100) : null;
  const where = publicWaterLocationLabel({ type, county, countyIds });
  return (
    <div
      data-water-card=""
      className={cn(
        // Sized by its own width (the phone sheet ~343px, the list column 335–900px): from a 512px
        // card the media is ~38% of it (4:3, ≤280px) beside the facts and the actions row.
        'group @container relative overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]',
        'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-within:shadow-[var(--shadow-e2),var(--shadow-e0)]',
      )}
    >
      {/* The title row across the top (imobiliare's), a hairline under it. */}
      <h3 className="flex min-w-0 items-center gap-2 border-b border-hairline px-3.5 py-2.5 t-heading text-ink">
        <button
          type="button"
          onClick={onSelect}
          aria-busy={busy || undefined}
          className={cn(
            'min-w-0 cursor-pointer truncate text-left outline-none',
            // Stretched: the whole card selects the water on the map.
            "after:absolute after:inset-0 after:rounded-card after:content-['']",
            'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent',
          )}
        >
          {title}
        </button>
        {busy ? (
          <span className="flex shrink-0 items-center">
            <T2Spinner className="size-4 text-accent" />
            <span className="sr-only">Se încarcă</span>
          </span>
        ) : null}
      </h3>
      <div className="flex gap-3 p-3 @lg:gap-0 @lg:p-0">
        <Thumb type={type} shape={outline ?? null} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 @lg:gap-2.5 @lg:p-3.5">
          {ha != null ? (
            <p className="flex items-baseline gap-1 text-ink">
              <span className="t-stat tabular-nums @lg:t-display">{ha.toLocaleString('ro-RO')}</span>
              <span className="t-body-strong text-ink-2">ha</span>
              <span className="sr-only"> suprafață</span>
            </p>
          ) : null}
          {where ? (
            <p className="flex min-w-0 items-center gap-1 t-caption text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-accent-ink">
              <MapPinIcon aria-hidden />
              <span className="truncate">{where}</span>
            </p>
          ) : null}
          <ul aria-label="Pe scurt" className="flex flex-wrap gap-1.5 @lg:border-t @lg:border-hairline @lg:pt-2.5">
            <li className={CHIP}>
              {type === 'river' ? <RiverIcon strokeWidth={2} /> : <LakeIcon />}
              {PUBLIC_WATER_TYPE_LABEL[type]}
            </li>
            {claimed ? <li className={cn(CHIP, 'bg-accent-tint text-accent-ink')}>Baltă pe Bluvi</li> : null}
          </ul>
          {/* The actions as their own row (above the stretched button: each is its own target). */}
          <div className="relative z-above mt-auto hidden items-center justify-end gap-2 border-t border-hairline pt-2.5 @lg:flex">
            <Actions title={title} href={href} onDirections={onDirections} />
          </div>
        </div>
      </div>
      <div className="relative z-above flex items-center justify-end gap-2 border-t border-hairline px-3 py-2 @lg:hidden">
        <Actions title={title} href={href} onDirections={onDirections} />
      </div>
    </div>
  );
}

const CHIP = 'flex items-center gap-1 rounded-full bg-page px-2.5 py-1 t-caption text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-accent-ink';

function Actions({ title, href, onDirections }: { title: string; href: string; onDirections: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onDirections}
        aria-haspopup="dialog"
        aria-label={`Direcții către ${title}`}
        className={buttonClass({ variant: 'secondary', size: 'compact', className: 'gap-1.5' })}
      >
        <PaperAirplaneIcon aria-hidden className="size-4 stroke-2" />
        Direcții
      </button>
      <Link href={href} aria-label={`Vezi apa ${title}`} className={buttonClass({ variant: 'primary', size: 'compact', className: 'gap-1.5' })}>
        Vezi apa
        <ArrowRightIcon aria-hidden className="size-4 stroke-2" />
      </Link>
    </>
  );
}

/**
 * The card's media: the water's outline when known (each water its own shape), else its type glyph
 * — 4:3 on the accent tint. Phone: a 112px tile; from a 512px card ~38% of it (≤280px), flush left.
 */
function Thumb({ type, shape }: { type: PublicWaterType; shape: WaterOutline | null }) {
  return (
    <span
      aria-hidden
      className="flex aspect-4/3 w-28 shrink-0 items-center justify-center self-start overflow-hidden rounded-control bg-accent-tint text-accent-ink @lg:w-[38%] @lg:max-w-70 @lg:rounded-none"
    >
      {shape ? (
        <svg viewBox="-8 -8 116 116" preserveAspectRatio="xMidYMid meet" className="size-full p-2 @lg:p-4">
          <path
            d={shape.d}
            vectorEffect="non-scaling-stroke"
            className={cn('stroke-current', shape.closed ? 'fill-accent-tint-3' : 'fill-none')}
            strokeWidth={shape.closed ? 1.5 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : type === 'river' ? (
        <RiverIcon className="size-8 @lg:size-12" strokeWidth={1.8} />
      ) : (
        <LakeIcon className="size-7 @lg:size-11" />
      )}
    </span>
  );
}
