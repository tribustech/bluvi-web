'use client';

import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { T2BackLink, T2Spinner, T2Viewport } from '@/components/templates/T2';
import { DetailBackButton } from '@/components/templates/T3';
import { publicWaterName, waterFitBounds, type PublicWaterDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { FocusAfterWaterRetry } from './retryFocus';
import { waterTrail } from './trail';
import { WaterMap } from './WaterMap';

/*
 * fish public-waters/[id]/map.tsx: the whole screen is the map (pan + zoom; no rotate / pitch),
 * fitted to the water with room for the back control on top and the card at the bottom; the water
 * in the amber outline over the indigo wash; a floating back control top-left (the T2 map's own,
 * T2BackLink, as on /ape-publice); a bottom card with the name (one line) and the primary county —
 * T2MapCard's shell (radius, e2, 12px padding, t-heading + t-caption), static: T2MapCard is a link
 * with a ✕, and this card is neither. TODO(kit): T2MapCard without href / onClose, then use it.
 * TODO(kit): T2Viewport `bleed` (the full-bleed below is T2Layout's own trick, copied).
 *
 * From 768 the shell's breadcrumb band sits right above: GAP closes it with the band's own white
 * and hairline (the 16px the T2 toolbar band gives /ape-publice and /balti/harta), so the trail
 * never sits on the map's edge.
 */

const GAP = <div aria-hidden className="hidden h-4 shrink-0 border-b border-hairline bg-surface md:block" />;

/** fish edgePadding: top inset + 72, sides 36, bottom inset + 120. */
const PADDING = { top: 72, right: 36, bottom: 120, left: 36 };

export function WaterFullMap({ water }: { water: PublicWaterDetail }) {
  const name = publicWaterName(water);
  const key = water.linkCode ?? water.id;
  return (
    <T2Viewport className="mx-[calc(50%-50vw)] w-screen">
      <SetBreadcrumb trail={waterTrail({ name, key }, { map: true })} />
      <FocusAfterWaterRetry target="harta-apa-titlu" />
      <h1 id="harta-apa-titlu" className="sr-only">{`Hartă ${name}`}</h1>
      {GAP}
      <div className="relative min-h-0 flex-1">
        <WaterMap
          label={`Hartă ${name}`}
          initialBounds={waterFitBounds(water)}
          initialPadding={PADDING}
          selected={{ id: water.id, type: water.type, geometry: water.geometry }}
          selectedFill="indigo"
        />
        <div className="absolute top-4 left-4 z-overlay">
          <T2BackLink href={routes.publicWater(key)} label="Înapoi" />
        </div>
        <div className="absolute inset-x-4 bottom-[max(--spacing(10),env(safe-area-inset-bottom))] z-overlay flex flex-col gap-1.5 rounded-card bg-surface p-3 shadow-e2 md:bottom-10 md:left-4 md:right-auto md:w-95">
          <p className="truncate t-heading text-ink">{name}</p>
          {water.county ? <p className="t-caption text-muted">{water.county}</p> : null}
        </div>
      </div>
    </T2Viewport>
  );
}

/**
 * fish: a centred spinner with the back control (parity public-waters.harta.c1). The <h1> is there
 * while loading too, and the back control is history back — the way the user came (the water
 * page, as a rule), like the water page's own back.
 */
export function WaterMapLoading() {
  return (
    <T2Viewport className="mx-[calc(50%-50vw)] w-screen">
      <h1 className="sr-only">Hartă apă publică</h1>
      {GAP}
      <div aria-busy="true" className="relative flex min-h-0 flex-1 items-center justify-center bg-soft-fill">
        <p role="status" className="flex items-center gap-2 t-body text-muted">
          <T2Spinner className="size-6 text-accent" />
          Se încarcă harta…
        </p>
        <div className="absolute top-4 left-4">
          <DetailBackButton fallbackHref={routes.publicWaters()} onPhoto />
        </div>
      </div>
    </T2Viewport>
  );
}
