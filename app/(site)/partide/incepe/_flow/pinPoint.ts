'use client';

import * as z from 'zod';
import type { QueryClient } from '@tanstack/react-query';
import { claimedPublicWatersQuery, lakeQuery, lakesIndexQuery, publicWaterListItemSchema, toClaimedPublicWatersMap, type PublicWaterListItem } from '@/core/lakes';
import { resolvePinVenue, type VenueSelection } from '@/core/partide';
import type { Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import type { Coord } from './model';

/*
 * The browser half of fish's pin resolution (VenuePicker handlePinDropped → core resolvePinVenue):
 * the public water + county at a point come from this flow's own read-only route
 * (../api/apa-la-punct — fish's on-device getWaterAtPoint / nearestCountyTo), the lakes index, the
 * lake detail and the claimed-waters map from React Query's cache (fetchQuery: a warm cache costs no
 * request).
 */

const pointSchema = z.object({ water: publicWaterListItemSchema.nullable(), county: z.string().nullable() });
export type PointInfo = z.infer<typeof pointSchema>;

/** «/partide/incepe/api/apa-la-punct» — next to the page (routes.startPartida), never hard-coded twice. */
const POINT_API = `${routes.startPartida()}/api/apa-la-punct`;

export async function fetchPointInfo(lat: number, lng: number, toleranceDeg?: number): Promise<PointInfo> {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (toleranceDeg != null) q.set('tol', String(toleranceDeg));
  const res = await fetch(`${POINT_API}?${q}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`apa-la-punct: HTTP ${res.status}`);
  return pointSchema.parse(await res.json());
}

export const pointInfoKey = (c: Coord) => ['partide', 'start', 'point', c.lat.toFixed(5), c.lng.toFixed(5)] as const;

/** The pin's county (fish nearestCountyTo), cached per point; null when unknown. */
export async function countyOfPoint(qc: QueryClient, c: Coord): Promise<string | null> {
  try {
    const info = await qc.fetchQuery({ queryKey: pointInfoKey(c), queryFn: () => fetchPointInfo(c.lat, c.lng), staleTime: Infinity });
    return info.county;
  } catch {
    return null;
  }
}

/** fish handlePinDropped's resolvePinVenue call, with its deps wired to the web's sources. */
export async function resolveDroppedPin(qc: QueryClient, t: Transport, coord: Coord): Promise<VenueSelection> {
  let claimedMap = new Map<string, string>();
  try {
    claimedMap = toClaimedPublicWatersMap(await qc.fetchQuery(claimedPublicWatersQuery(t)));
  } catch {
    // Best effort (fish): without the claims a claimed water resolves to the water itself.
  }
  return resolvePinVenue(coord, 'Loc nou', {
    getLakesIndex: () => qc.fetchQuery(lakesIndexQuery(t)),
    getLake: id => qc.fetchQuery(lakeQuery(t, id)),
    claimedMap,
    getWaterAtPoint: async (lat, lng, tol): Promise<PublicWaterListItem | null> => {
      const info = await qc.fetchQuery({ queryKey: pointInfoKey({ lat, lng }), queryFn: () => fetchPointInfo(lat, lng, tol), staleTime: Infinity });
      return info.water;
    },
  });
}
