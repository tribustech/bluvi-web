import 'server-only';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { DehydratedState } from '@tanstack/react-query';
import { publicWaterName, type PublicWaterDetail } from '@/core/lakes';
import type { CommunityVenueRef } from '@/core/partide';
import type { Transport, TransportRequest } from '@/core/transport';
import { prefetchState, type Prefetchable } from '@/lib/client/hydration';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { e2eSkipPrefetch, e2eWaterFault, e2eWaterOverride } from './e2e-faults';
import { canonicalPath, loadPublicWater } from './load';

/*
 * The public-water subpages' server half (capturi, clasament, partide, statistici — parity
 * public-waters.{capturi,clasament,partide,statistici}).
 *
 *  - The water resolves like the detail page (row id or linkCode, c1). A water WITHOUT a linkCode
 *    has no community identity to scope the page to: a permanent not-found (no retry), as in fish.
 *    A missing water is the same not-found; a dataset failure throws to the route's error.tsx.
 *  - Like fish, a claimed water is NOT rerouted here (only the map, the search and the detail page
 *    reroute to the lake — public-waters.b.claimed-redirect); the subpages show the water's own
 *    community data.
 *  - The community reads are public CMS GETs (cached by the CMS's own headers and purged by its
 *    tags, lib/server/public-get.ts); the first page / period is prefetched into the HTML and the
 *    client screen takes over the SAME core/ query (HydrationBoundary). Each read is bounded: a hung
 *    CMS never holds the page — the browser's query then shows its own loading / error state. A
 *    failed read opts the page out of the prerender (`connection()`), so an error is never baked in.
 */

export const READ_BUDGET_MS = 4000;

export type CommunityWater = { water: PublicWaterDetail; code: string; venue: CommunityVenueRef; name: string; key: string };

/** The water of a subpage, or notFound() (unknown, or no linkCode). */
export async function loadCommunityWater(id: string): Promise<CommunityWater> {
  await e2eWaterFault(id);
  const load = await loadPublicWater(id);
  if (load.kind === 'missing') notFound();
  const water = e2eWaterOverride(id, load.water);
  if (!water.linkCode) notFound();
  return { water, code: water.linkCode, venue: { kind: 'water', code: water.linkCode }, name: publicWaterName(water), key: water.linkCode };
}

/**
 * For generateMetadata, split three ways: the water (it has a community page), `missing` (unknown, or
 * no linkCode: the not-found metadata) and `error` (the dataset failed: generic metadata — never
 * «not found» for a water that may well exist).
 * Not a real 404 status for crawlers: with Cache Components every route streams its static shell
 * (loading.tsx) first, and neither the page's nor generateMetadata's notFound() can change a status
 * that has been sent (node_modules/next/dist/docs …/functions/not-found.md, «Status codes»); the
 * soft 404 carries `noindex`. TODO(proxy): a real 404 needs the dataset check in proxy.ts (outside
 * this unit's scope).
 */
export async function metadataWater(id: string): Promise<PublicWaterDetail | 'missing' | 'error'> {
  try {
    const load = await loadPublicWater(id);
    return load.kind === 'ok' && load.water.linkCode ? load.water : 'missing';
  } catch {
    return 'error';
  }
}

/** Metadata of a subpage whose water did not resolve (see metadataWater). */
export function unresolvedMetadata(state: 'missing' | 'error'): Metadata {
  return state === 'missing' ? { title: 'Apa publică nu a fost găsită', robots: { index: false } } : { title: 'Apă publică', robots: { index: false } };
}

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what}: CMS read over ${ms}ms`)), ms);
    promise.then(
      (v) => {
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

function boundedTransport(): Transport {
  const t = createServerTransport();
  return { request: <T>(req: TransportRequest) => within(t.request<T>(req), READ_BUDGET_MS, req.path) };
}

/** Prefetches `queries` for the client screen (see the header). */
export async function prefetchWater(id: string, queries: (t: Transport) => readonly Prefetchable[]): Promise<DehydratedState> {
  if (e2eSkipPrefetch(id)) {
    await connection();
    return { mutations: [], queries: [] };
  }
  const list = queries(boundedTransport());
  const state = await prefetchState(list, []);
  if (state.queries.length !== list.length) await connection();
  return state;
}

export type SubPage = 'partide' | 'statistici' | 'clasament' | 'capturi';

/** The subpage's canonical path: the stable linkCode, without the view params (period, photo). */
const SUB_ROUTE: Record<SubPage, (idOrCode: string | number) => string> = {
  partide: routes.publicWaterPartide,
  statistici: (k) => routes.publicWaterStats(k),
  clasament: (k) => routes.publicWaterRanking(k),
  capturi: (k) => routes.publicWaterCatches(k),
};

export function subPath(water: PublicWaterDetail, page: SubPage): string {
  return SUB_ROUTE[page](water.linkCode ?? water.id);
}

/** «Bălți / Ape publice / <apă> / <subpagină>» — the shell's band and the JSON-LD. */
export function subTrail(water: PublicWaterDetail, label: string) {
  return [
    { label: 'Bălți', href: routes.lakes() },
    { label: 'Ape publice', href: routes.publicWaters() },
    { label: publicWaterName(water), href: canonicalPath(water) },
    { label },
  ];
}

/** schema.org BreadcrumbList of a subpage. */
export function breadcrumbJsonLd(water: PublicWaterDetail, label: string, path: string) {
  return breadcrumbListJsonLd(subTrail(water, label), path);
}

/** «<titlu> · <apă>», its own canonical and Open Graph. */
export function subMetadata(water: PublicWaterDetail, { title, description, page }: { title: string; description: string; page: SubPage }): Metadata {
  const full = `${title} · ${publicWaterName(water)}`;
  const path = subPath(water, page);
  return {
    title: full,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title: full, description, url: absoluteUrl(path), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary', title: full, description },
  };
}

