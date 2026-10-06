'use client';

import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PHOTO_PILL, photoHeroHeight } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { waterFitBounds, type PublicWaterDetail } from '@/core/lakes';
import { MapAttribution, WaterMap, type WaterPadding } from '../WaterMap';

/**
 * fish PublicWaterMapHero: a still map (no pan / zoom / rotate / pitch) fitted to the water with
 * 34px padding (centre ± 0.1° when the geometry has < 2 coordinates), the water in the amber
 * outline on the indigo wash, a scrim at the top for the back chip; the whole map is one link
 * «Deschide harta pentru <name>» to the full map. The page's media at every width:
 *  - phone: on top (`max-md:-order-1`; after the header in the DOM), full bleed, the page's back /
 *    share chips over it (DetailHeroTopControls);
 *  - from 768 (owner rule 1, ROADMAP §4b — title → media → two columns): under the title row, a
 *    radius-16 band inside the gutters (never the full-bleed slab), the photo grid's place and
 *    height; from 1024 the map takes two thirds and `fill` (the community's catch photos) the right
 *    third when there is one, as a lake with one photo.
 * The fill arrives with the catches read: the band keeps its height and the map its centre, so
 * only the map's width changes.
 *
 * The band's height is the T3 photo hero's (photoHeroHeight), the one the loading skeleton draws,
 * so the page does not jump when it loads. The fit keeps fish's 34px on every side as a minimum and
 * reserves the overlays on top of it — the «Deschide harta» pill (top), the back chip and its scrim
 * (phone top), the «ⓘ» credits chip (bottom) — so the water is never drawn under them.
 */

export const WATER_HERO_HEIGHT = photoHeroHeight(2);

function heroPadding(): WaterPadding {
  const phone = !window.matchMedia('(min-width: 768px)').matches;
  return { top: phone ? 76 : 64, right: 34, bottom: 40, left: 34 };
}

export function WaterHero({ water, name, mapHref, fill }: { water: PublicWaterDetail; name: string; mapHref: string; fill?: ReactNode }) {
  return (
    <div
      data-t3="photo"
      className={cn(
        'max-md:-order-1 md:mx-6 md:mb-6 md:overflow-hidden md:rounded-card xl:mx-8',
        !!fill && 'min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[1024px]:gap-2',
        WATER_HERO_HEIGHT,
      )}
    >
      <div className="group/hero relative h-full overflow-hidden bg-soft-fill">
        {/* The map answers the link under the pointer: a touch darker on hover, more while pressed. */}
        <div className="absolute inset-0 transition-[filter] duration-(--duration-fast) ease-fast group-has-[>a:hover]/hero:brightness-97 group-has-[>a:active]/hero:brightness-90">
          <WaterMap
            label={`Hartă ${name}`}
            interactive={false}
            initialBounds={waterFitBounds(water)}
            initialPadding={heroPadding}
            attribution="none"
            selected={{ id: water.id, type: water.type, geometry: water.geometry }}
            selectedFill="indigo"
            loadingStatus={false}
          />
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-photo-scrim to-transparent md:hidden" />
        <Link
          href={mapHref}
          aria-label={`Deschide harta pentru ${name}`}
          className="group/link absolute inset-0 z-above outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
        >
          <span
            aria-hidden
            className={cn(
              PHOTO_PILL,
              'absolute top-4 right-18 flex items-center gap-1.5 transition-[background-color,opacity] duration-(--duration-fast) ease-fast md:right-4',
              'group-hover/link:bg-navy group-active/link:opacity-90',
            )}
          >
            <ArrowsPointingOutIcon className="size-4" />
            Deschide harta
          </span>
        </Link>
        {/* Over the link (which covers the map), so the chip stays its own target. */}
        <MapAttribution mode="compact" />
      </div>
      {fill ? <div className="hidden h-full min-h-0 flex-col gap-2 *:min-h-0 *:flex-1 min-[1024px]:flex">{fill}</div> : null}
    </div>
  );
}
