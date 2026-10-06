import type { Crumb } from '@/components/nav/Breadcrumbs';
import { routes } from '@/lib/routes';

/*
 * The one breadcrumb trail of the public-water screens: public waters live in the Bălți section
 * (fish shows them in the Bălți tab; the map is «Bălți / Ape publice»), so every trail starts at
 * Bălți, like the lake page. Shared by the map, the water page, its full map and the JSON-LD.
 */

export const LAKES_CRUMB: Crumb = { label: 'Bălți', href: routes.lakes() };
export const PUBLIC_WATERS_CRUMB: Crumb = { label: 'Ape publice', href: routes.publicWaters() };

/**
 * `water` omitted: the map itself («Bălți / Ape publice»). With a water: «… / <name>»; with
 * `map`: «… / <name> / Hartă» (the water linked). The last crumb is the current page (no href).
 */
export function waterTrail(water?: { name: string; key: string | number }, opts: { map?: boolean } = {}): Crumb[] {
  if (!water) return [LAKES_CRUMB, { label: PUBLIC_WATERS_CRUMB.label }];
  if (!opts.map) return [LAKES_CRUMB, PUBLIC_WATERS_CRUMB, { label: water.name }];
  return [LAKES_CRUMB, PUBLIC_WATERS_CRUMB, { label: water.name, href: routes.publicWater(water.key) }, { label: 'Hartă' }];
}
