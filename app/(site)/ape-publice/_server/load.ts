import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import {
  getClaimedPublicWaters,
  parsePublicWaterRouteParam,
  publicWaterBasinName,
  publicWaterName,
  publicWaterSubtitle,
  toClaimedPublicWatersMap,
  type PublicWaterDetail,
} from '@/core/lakes';
import { routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { sqlitePublicWatersSource as src } from './source';

/*
 * Server reads of the public-water pages. The dataset is bundled with the build (it only changes
 * with a new DB version), so its reads are cached for as long as the build lives (`cacheLife('max')`);
 * the claim map is a public CMS GET cached by the CMS's own headers and purged by its
 * `public-waters-claimed` tag (lib/server/public-get.ts).
 */

export type WaterLoad = { kind: 'ok'; water: PublicWaterDetail } | { kind: 'missing' };

async function readWater(param: string): Promise<WaterLoad> {
  'use cache';
  cacheLife('max');
  const parsed = parsePublicWaterRouteParam(param);
  if (!parsed) return { kind: 'missing' };
  const water = parsed.kind === 'id' ? await src.getPublicWaterById(parsed.id) : await src.getPublicWaterByLinkCode(parsed.code);
  return water ? { kind: 'ok', water } : { kind: 'missing' };
}

/** fish useResolvedPublicWater: numeric row id or ANAR linkCode; empty → not found, no lookup. */
export const loadPublicWater = cache((param: string) => readWater(decodeParam(param)));

/** Route params arrive percent-encoded when the code carries «:» (R%3ARO11…). */
function decodeParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/** County names of a multi-county river (fish getCountyNamesByIds); [] when it fails. */
export async function loadCountyNames(ids: number[]): Promise<string[]> {
  'use cache';
  cacheLife('max');
  if (ids.length <= 1) return [];
  try {
    return await src.getCountyNamesByIds(ids);
  } catch {
    return [];
  }
}

/** The CC-BY attribution string embedded in the dataset (null when absent / unreadable). */
export async function loadAttribution(): Promise<string | null> {
  'use cache';
  cacheLife('max');
  try {
    return await src.getAttribution();
  } catch {
    return null;
  }
}

/**
 * fish useClaimedPublicWaters as a lookup: linkCode → lake documentId. An unreadable claim map is
 * an empty one for THIS response (fish: «empty map until loaded = no reroute»), but never for long:
 * the detail pages are prerendered and cached, so a failed read lives only minutes (the page is
 * rendered again soon and a claimed water then redirects, c4); a good one an hour, purged by the
 * CMS's `public-waters-claimed` tag on every lake write.
 */
async function readClaimedLakeId(linkCode: string): Promise<string | null> {
  'use cache';
  try {
    const rows = await getClaimedPublicWaters(createServerTransport());
    cacheTag('public-waters-claimed');
    cacheLife('hours');
    return toClaimedPublicWatersMap(rows).get(linkCode) ?? null;
  } catch {
    cacheLife('minutes');
    return null;
  }
}

export const loadClaimedLakeId = cache(async (linkCode: string | null): Promise<string | null> => {
  if (!linkCode) return null;
  try {
    return await readClaimedLakeId(linkCode);
  } catch {
    return null;
  }
});

const AREA = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

/** Meta description: «Snagov — lac de acumulare · ilfov, suprafață 5,57 km², …» (Romanian notation). */
export function waterDescription(water: PublicWaterDetail): string {
  const name = publicWaterName(water);
  const parts = [`${name} — ${publicWaterSubtitle(water).toLowerCase()}`];
  if (water.areaKm2) parts.push(`suprafață ${AREA.format(water.areaKm2)} km²`);
  const basin = publicWaterBasinName(water.basin);
  if (basin) parts.push(`bazinul hidrografic ${basin}`);
  return `${parts.join(', ')}. Hartă, partide de pescuit și capturi pe ${name} în Bluvi.`;
}

/** The canonical URL: the stable linkCode (row ids may change with a new dataset version). */
export const canonicalKey = (water: PublicWaterDetail): string | number => water.linkCode ?? water.id;

export function canonicalPath(water: PublicWaterDetail): string {
  return routes.publicWater(water.linkCode ?? water.id);
}
