'use client';

import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { PHOTO_PILL, photoHeroHeight } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { waterFitBounds, type PublicWaterDetail } from '@/core/lakes';
import { MapAttribution, WaterMap, type WaterPadding } from '../WaterMap';

/**
 * fish PublicWaterMapHero: a still map (no pan / zoom / rotate / pitch) fitted to the water with
 * 34px padding (centre ± 0.1° when the geometry has < 2 coordinates), the water in the amber
 * outline on the indigo wash, a scrim at the top for the back chip; the whole map is one link
 * «Deschide harta pentru <name>» to the full map. Two places, one map at a time:
 *  - `band` (below 1024): phone — on top (`max-md:-order-1`; after the header in the DOM), full
 *    bleed, the page's back / share chips over it (DetailHeroTopControls); 768–1023 — under the title
 *    row, a radius-16 band of the column's width (the Airbnb photo grid's place), 320px.
 *  - `card` (from 1024): the top of the sticky summary card (owner rule 1, ROADMAP §4b — never a
 *    full-width slab over a short page; the map, the facts and Direcții sit together).
 * Only the one on screen mounts its map (WebGL), decided after hydration; until then the band is
 * the soft fill of the size it will have.
 *
 * The band's height is the T3 photo hero's (photoHeroHeight), the one the loading skeleton draws,
 * so the page does not jump when it loads. The fit keeps fish's 34px on every side as a minimum and
 * reserves the overlays on top of it — the «Deschide harta» pill (top), the back chip and its scrim
 * (phone top), the «ⓘ» credits chip (bottom) — so the water is never drawn under them.
 */

export const WATER_HERO_HEIGHT = photoHeroHeight(2);

const WIDE = '(min-width: 1024px)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
/** From 1024 (the summary card's width)? null while it is not known (server, before hydration). */
function useWide(): boolean | null {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => null);
}

function heroPadding(): WaterPadding {
  const phone = !window.matchMedia('(min-width: 768px)').matches;
  return { top: phone ? 76 : 64, right: 34, bottom: 40, left: 34 };
}
const CARD_PADDING: WaterPadding = { top: 56, right: 24, bottom: 36, left: 24 };

export function WaterHero({
  water,
  name,
  mapHref,
  variant = 'band',
}: {
  water: PublicWaterDetail;
  name: string;
  mapHref: string;
  variant?: 'band' | 'card';
}) {
  const wide = useWide();
  const card = variant === 'card';
  const mounted = wide !== null && wide === card;
  return (
    <div
      data-t3={card ? 'water-map' : 'photo'}
      className={cn(
        'group/hero relative overflow-hidden bg-soft-fill',
        card ? 'h-48 w-full rounded-card' : cn('max-md:-order-1 md:mx-6 md:mb-6 md:rounded-card xl:mx-8 min-[1024px]:hidden', WATER_HERO_HEIGHT),
      )}
    >
      {mounted ? (
        <>
          {/* The map answers the link under the pointer: a touch darker on hover, more while pressed. */}
          <div className="absolute inset-0 transition-[filter] duration-(--duration-fast) ease-fast group-has-[>a:hover]/hero:brightness-97 group-has-[>a:active]/hero:brightness-90">
            <WaterMap
              label={`Hartă ${name}`}
              interactive={false}
              initialBounds={waterFitBounds(water)}
              initialPadding={card ? CARD_PADDING : heroPadding}
              attribution="none"
              selected={{ id: water.id, type: water.type, geometry: water.geometry }}
              selectedFill="indigo"
              loadingStatus={false}
            />
          </div>
          {!card ? <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-photo-scrim to-transparent md:hidden" /> : null}
        </>
      ) : null}
      <Link
        href={mapHref}
        aria-label={`Deschide harta pentru ${name}`}
        className="group/link absolute inset-0 z-above outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
      >
        <span
          aria-hidden
          className={cn(
            PHOTO_PILL,
            'absolute flex items-center gap-1.5 transition-[background-color,opacity] duration-(--duration-fast) ease-fast group-hover/link:bg-navy group-active/link:opacity-90',
            // Phone band: left of the share chip (DetailHeroTopControls, 48px + 8).
            card ? 'top-3 right-3' : 'top-4 right-18 md:right-4',
          )}
        >
          <ArrowsPointingOutIcon className="size-4" />
          Deschide harta
        </span>
      </Link>
      {/* Over the link (which covers the map), so the chip stays its own target. */}
      {mounted ? <MapAttribution mode="compact" /> : null}
    </div>
  );
}
