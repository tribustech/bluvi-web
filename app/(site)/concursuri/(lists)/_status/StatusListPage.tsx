import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { filteredCompetitionsInfiniteQuery, type CompetitionListResponse } from '@/core/competitions';
import { prefetchState } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { bounded } from '../../_list/server';
import { STATUS_LIST_PAGINATION, STATUS_LISTS, statusListTrail, type StatusListKey } from './config';
import { crashIfFaulted, withStatusListFault } from './faults';
import { StatusListScreen } from './StatusListScreen';
import { StatusListFallback, StatusListShell } from './StatusListShell';

/*
 * A global status list — fish app/(app)/competitions/{notStarted,started,completed}/index.tsx on T1
 * (parity competitions-list.viitoare / .live / .incheiate).
 *
 * Rendering: the URL has no parameters, so the page is static. Its first page
 * (/feed/competitions?status=…, a public read cached by Next under the CMS's own CDN-Cache-Control
 * and purged with its `competitions-list` tag — lib/server/public-get.ts) is read on the server,
 * bounded, and handed to the client list, which takes over the SAME core/ query
 * (HydrationBoundary): the cards are in the HTML for crawlers and the first paint, the next pages
 * load in the browser. A failed or over-budget read never becomes static output (`connection()`):
 * the page is then rendered per request and the browser's own query shows its loading / error
 * states. JSON-LD: a CollectionPage with an ItemList of SportsEvent, and the breadcrumb.
 *
 * Breadcrumb: the page renders its own band on the server — «Competiții / {title}», the same
 * parent as the competition page (COMPETITIONS_CRUMB) and the page's h1 as the last step — with its
 * BreadcrumbList JSON-LD from the same trail (one answer on screen and for crawlers). The layout's
 * URL-derived band skips these routes (SiteHeader ownsBreadcrumbBand).
 */

export function statusListMetadata(list: StatusListKey): Metadata {
  const cfg = STATUS_LISTS[list];
  const path = routes.competitionsByStatus(list);
  return {
    title: cfg.title,
    description: cfg.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      siteName: 'Bluvi',
      locale: 'ro_RO',
      title: `${cfg.title} · Bluvi`,
      description: cfg.description,
    },
    twitter: {
      card: 'summary',
      title: `${cfg.title} · Bluvi`,
      description: cfg.description,
    },
  };
}

export function StatusListPage({ list }: { list: StatusListKey }) {
  return (
    <>
      <BreadcrumbBand trail={statusListTrail(list)} jsonLd />
      {/* The header (back, title, count, refresh, tabs) is outside the boundary: the same DOM while
          the first page streams, when the screen mounts and when the cards land (StatusListShell). */}
      <StatusListShell list={list}>
        <Suspense fallback={<StatusListFallback />}>
          <Data list={list} />
        </Suspense>
      </StatusListShell>
    </>
  );
}

async function Data({ list }: { list: StatusListKey }) {
  const cfg = STATUS_LISTS[list];
  // The fault wrapper sits inside the budget, so a `<list>-slow` fault runs out of it like a slow CMS.
  const t = bounded(withStatusListFault(createServerTransport(), list));
  const query = filteredCompetitionsInfiniteQuery(t, {
    status: cfg.status,
    pagination: STATUS_LIST_PAGINATION,
  });
  const state = await prefetchState([query], ['competitions-list']);
  if (state.queries.length === 0) await connection();
  crashIfFaulted(list);
  const first = (state.queries[0]?.state.data as { pages?: CompetitionListResponse[] } | undefined)?.pages?.[0]?.data ?? [];

  const url = absoluteUrl(routes.competitionsByStatus(list));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: cfg.title,
    description: cfg.description,
    inLanguage: 'ro-RO',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: first.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'SportsEvent',
          name: c.name,
          url: absoluteUrl(routes.competition(c.documentId)),
          sport: 'Pescuit sportiv',
          startDate: c.startDate,
          endDate: c.endDate,
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          ...(c.lake
            ? {
                location: {
                  '@type': 'Place',
                  name: c.lake.name,
                  url: absoluteUrl(routes.lake(c.lake.documentId)),
                },
              }
            : {}),
          ...((c.banner ?? c.lake?.images[0]) ? { image: (c.banner ?? c.lake?.images[0])?.url } : {}),
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // `<` escaped so no string can close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <HydrationBoundary state={state}>
        {/* hydrated: the server's page is in the HTML — the browser keeps it (no read on mount);
            otherwise its read already failed — the browser reads once, without the retry chain. */}
        <StatusListScreen list={list} serverRead={state.queries.length > 0 ? 'hydrated' : 'failed'} />
      </HydrationBoundary>
    </>
  );
}
