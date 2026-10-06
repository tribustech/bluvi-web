'use client';

import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DetailBackButton, PHOTO_PILL, photoHeroHeight } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { waterFitBounds, type PublicWaterDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { MapAttribution, WaterMap, type WaterPadding } from '../WaterMap';

/**
 * fish PublicWaterMapHero: a still map (no pan / zoom / rotate / pitch) fitted to the water with
 * 34px padding (centre ± 0.1° when the geometry has < 2 coordinates), the water in the amber
 * outline on the indigo wash, a scrim at the top for the back chip; the whole hero is one button
 * «Deschide harta pentru <name>» to the full map. Phone: first, the back chip on it. From 768:
 * under the title, a rounded band of the column's width (DetailPhotoHero's place).
 *
 * The height is the T3 photo hero's (photoHeroHeight), the one the loading skeleton draws, so the
 * page does not jump when it loads. The fit keeps fish's 34px on every side as a minimum and
 * reserves the overlays on top of it — the «Deschide harta» pill (top), the back chip and its scrim
 * (phone top), the «ⓘ» credits chip (bottom) — so the water is never drawn under them.
 */

export const WATER_HERO_HEIGHT = photoHeroHeight(2);

function heroPadding(): WaterPadding {
  const phone = !window.matchMedia('(min-width: 768px)').matches;
  return { top: phone ? 76 : 64, right: 34, bottom: 40, left: 34 };
}
export function WaterHero({ water, name, mapHref }: { water: PublicWaterDetail; name: string; mapHref: string }) {
  return (
    <div data-t3="photo" className={cn('group/hero relative md:order-1 md:mx-6 md:mb-6 md:overflow-hidden md:rounded-bento xl:mx-8', WATER_HERO_HEIGHT)}>
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
            'absolute top-4 right-4 flex items-center gap-1.5 transition-[background-color,opacity] duration-(--duration-fast) ease-fast group-hover/link:bg-navy group-active/link:opacity-90',
          )}
        >
          <ArrowsPointingOutIcon className="size-4" />
          Deschide harta
        </span>
      </Link>
      {/* Over the link (which covers the map), so the chip stays its own target. */}
      <MapAttribution mode="compact" />
      <div className="absolute top-4 left-4 z-sticky md:hidden">
        <DetailBackButton fallbackHref={routes.publicWaters()} onPhoto />
      </div>
    </div>
  );
}
