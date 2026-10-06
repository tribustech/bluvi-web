import 'server-only';

/*
 * Development-only fault switch for the public-water pages' e2e tests (tests/e2e/ape-publice.spec.ts):
 * the water is read on the server (a bundled dataset, cached), so page.route can neither slow nor
 * fail it. A test POSTs to /ape-publice/<id>/e2e-fault (../[id]/e2e-fault/route.ts) and the next
 * renders of THAT route param see the faults:
 *  - `slow`: the read waits 2.5s (the route's loading state streams first — c2 / harta.c1);
 *  - `error`: the read fails like a dataset failure (error.tsx with «Încearcă din nou» — c3 / harta.c2);
 * and overrides of what the read returns, for states the local data does not have:
 *  - `claimed:<lakeDocumentId>`: the claim map says a lake claimed this water (c4 / s4 redirect);
 *  - `nolinkcode`: the water has no ANAR link code (c32 / s5: no community sections, no code row);
 *  - `nofacts`: no basin / area / volume / altitude / EU code (s12: no «Detalii»);
 *  - `point`: a geometry with one coordinate (harta s5: centre ± 0.1°);
 *  - `noprefetch`: the subpages (partide, statistici, clasament, capturi) skip their server prefetch,
 *    so the browser makes the community reads and a test can serve them with page.route.
 * The lake page's switch (balti/[id]/_components/e2e-faults.ts) is the model. In production builds
 * both functions are no-ops (NODE_ENV is inlined) and the route answers 404.
 */

import type { PublicWaterDetail } from '@/core/lakes';

type Store = Map<string, Set<string>>;
const g = globalThis as typeof globalThis & { __bluviWaterE2eFaults?: Store };

export const e2eFaultsEnabled = () => process.env.NODE_ENV !== 'production';

export function e2eFaultStore(): Store {
  g.__bluviWaterE2eFaults ??= new Map();
  return g.__bluviWaterE2eFaults;
}

/** Resolves when the read may run; waits or throws when a fault for this param says so. */
export async function e2eWaterFault(param: string): Promise<void> {
  if (!e2eFaultsEnabled()) return;
  const faults = g.__bluviWaterE2eFaults?.get(param);
  if (!faults) return;
  if (faults.has('slow')) await new Promise((r) => setTimeout(r, 2500));
  if (faults.has('error')) throw new Error('e2e fault: public-waters dataset');
}

/** The `claimed:<id>` override for this param, if any (dev only). */
export function e2eClaimedLake(param: string): string | null {
  if (!e2eFaultsEnabled()) return null;
  const faults = g.__bluviWaterE2eFaults?.get(param);
  const claimed = faults ? [...faults].find((f) => f.startsWith('claimed:')) : undefined;
  return claimed ? claimed.slice('claimed:'.length) || null : null;
}

/** The water as the overrides for this param shape it (dev only; the cached read is never mutated). */
export function e2eWaterOverride(param: string, water: PublicWaterDetail): PublicWaterDetail {
  if (!e2eFaultsEnabled()) return water;
  const faults = g.__bluviWaterE2eFaults?.get(param);
  if (!faults) return water;
  let w = water;
  if (faults.has('nolinkcode')) w = { ...w, linkCode: null };
  if (faults.has('nofacts')) w = { ...w, basin: null, areaKm2: null, volumeMilM3: null, elevationM: null, euCode: null };
  if (faults.has('point')) w = { ...w, geometry: { type: 'LineString', coordinates: [[w.centerLng, w.centerLat]] } };
  return w;
}

/** The `noprefetch` switch for this param (dev only): the subpage leaves its community reads to the browser. */
export function e2eSkipPrefetch(param: string): boolean {
  if (!e2eFaultsEnabled()) return false;
  return g.__bluviWaterE2eFaults?.get(param)?.has('noprefetch') ?? false;
}
