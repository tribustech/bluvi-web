import 'server-only';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import type { DehydratedState } from '@tanstack/react-query';
import type { LakeDetail } from '@/core/lakes';
import type { Transport, TransportRequest } from '@/core/transport';
import { prefetchState, type Prefetchable } from '@/lib/client/hydration';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { hasCompetitions, lakeSubpageHas, lakesWithCompetitions, venueFacts, venueSubpageHas, type VenueSubpage } from '@/lib/server/sitemap-entries';
import { e2eFault } from '../_components/e2e-faults';

/*
 * The lake subpages' server reads (galerie, capturi, clasament, standuri, concursuri — parity
 * docs/parity/areas/lakes.yml). Same contract as the lake page (../_components/load.ts):
 *  - every read is a public CMS GET, cached by Next under the CMS's own CDN-Cache-Control and purged
 *    by its cache tags (lib/server/public-get.ts), so a subpage is static until the CMS purges it;
 *  - the first page / period the URL asks for is prefetched and handed to the client screen, which
 *    takes over the SAME core/ query (HydrationBoundary): the content is in the HTML (crawlers,
 *    first paint), the next pages / periods / tabs load in the browser;
 *  - each read is BOUNDED (READ_BUDGET_MS): a hung CMS never holds the page — the browser's own
 *    query then shows its loading and error states;
 *  - a FAILED read never becomes static output (`await connection()`): the page is rendered per
 *    request instead of baking a client-side error into the prerender.
 * Dev only: the lake page's e2e fault switch (../_components/e2e-faults.ts) also fails / delays
 * these reads by name (`stats`, `catches-page`, `competitions-tab`).
 */

export const READ_BUDGET_MS = 4000;

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what}: CMS read over ${ms}ms`)), ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** The server transport, bounded and wired to the dev-only fault switch for `read`. */
function subTransport(lakeId: string, read: string): Transport {
  const t = createServerTransport();
  return {
    request<T>(req: TransportRequest) {
      return within(
        e2eFault(lakeId, read).then(() => t.request<T>(req)),
        READ_BUDGET_MS,
        req.path,
      );
    },
  };
}

/**
 * Prefetches `queries` for the client screen. Returns the dehydrated state and whether every read
 * answered; a failed read leaves the client to fetch (and opts the page out of the prerender).
 */
export async function prefetchSub(
  lakeId: string,
  read: string,
  queries: (t: Transport) => readonly Prefetchable[],
): Promise<{ state: DehydratedState; ok: boolean }> {
  const list = queries(subTransport(lakeId, read));
  const state = await prefetchState(list, []);
  const ok = state.queries.length === list.length;
  if (!ok) await connection();
  return { state, ok };
}

/** The data a subpage hands its JSON-LD / breadcrumbs: the lake trail plus the subpage. */
export function subTrail(lake: LakeDetail, label: string) {
  return [
    { label: 'Bălți', href: routes.lakes() },
    { label: lake.name, href: routes.lake(lake.documentId) },
    { label },
  ];
}

/** schema.org BreadcrumbList for Bălți › {lake} › {subpage}. */
export function breadcrumbJsonLd(lake: LakeDetail, label: string, path: string) {
  return breadcrumbListJsonLd(subTrail(lake, label), path);
}

/**
 * Whether a lake subpage has nothing of its own to show — decided by the same predicates and the
 * same cached reads as the sitemap (lib/server/sitemap-entries.ts lakeUrls), so the two never
 * disagree: no reviews (/recenzii), no coordinates (/harta), no competition at the lake
 * (/concursuri, hasCompetitions), and for the community subpages the month AND year stats (a stats
 * page is judged by the widest period it offers) / the first catches page / the history (/galerie
 * also counts the lake's own photos). A read that fails (or times out) is «not known»: never empty
 * — a CMS hiccup must not noindex a page.
 */
export async function lakeSubpageEmpty(lake: LakeDetail, page: VenueSubpage | 'recenzii' | 'harta' | 'concursuri'): Promise<boolean> {
  if (page === 'recenzii') return !lakeSubpageHas.recenzii(lake);
  if (page === 'harta') return !lakeSubpageHas.harta(lake);
  if (page === 'concursuri') {
    const lakes = await lakesWithCompetitions(subTransport(lake.documentId, 'competitions-tab')).catch(() => null);
    return lakes ? hasCompetitions(lake.documentId, lakes) === false : false;
  }
  const facts = await venueFacts(subTransport(lake.documentId, 'stats'), { kind: 'lake', id: lake.documentId });
  return venueSubpageHas(page, facts, lake.images.length) === false;
}

/**
 * A subpage's metadata: «{title} · {lake}», its own canonical (without the view params — the
 * period, the tab, a photo — so one URL is indexed per subpage), Open Graph and a large Twitter
 * card. No image keys: the route's generated opengraph-image / twitter-image files provide the
 * share image (global.seo-og) and would be overridden by one set here.
 * `empty` (lakeSubpageEmpty): `noindex, follow` — the page has nothing of its own to show (rule 4,
 * global.b.seo-metadata m5) and the sitemap leaves it out.
 */
export function subMetadata(
  lake: LakeDetail,
  { title, description, path, empty = false }: { title: string; description: string; path: string; empty?: boolean },
): Metadata {
  const full = `${title} · ${lake.name}`;
  return {
    title: full,
    description,
    alternates: { canonical: path },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title: full, description, url: absoluteUrl(path), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title: full, description },
  };
}

/** The lake as the `about` of a subpage's CollectionPage. */
export function lakeAbout(lake: LakeDetail) {
  return { type: 'TouristAttraction', name: lake.name, path: routes.lake(lake.documentId) };
}
